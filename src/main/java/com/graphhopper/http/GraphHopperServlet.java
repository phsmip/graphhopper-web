/*
 *  Copyright 2012 Peter Karich
 * 
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 * 
 *       http://www.apache.org/licenses/LICENSE-2.0
 * 
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package com.graphhopper.http;

import com.graphhopper.routing.AStar;
import com.graphhopper.routing.Path;
import com.graphhopper.routing.util.AlgorithmPreparation;
import com.graphhopper.routing.util.FastestCarCalc;
import com.graphhopper.storage.Graph;
import com.graphhopper.storage.Location2IDIndex;
import com.graphhopper.util.DouglasPeucker;
import com.graphhopper.util.StopWatch;
import com.graphhopper.util.shapes.BBox;
import java.io.DataOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import javax.inject.Inject;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import static javax.servlet.http.HttpServletResponse.*;
import org.json.JSONException;
import org.json.JSONObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * @author Peter Karich
 */
public class GraphHopperServlet extends HttpServlet {

    private Logger logger = LoggerFactory.getLogger(getClass());
    @Inject private Graph graph;
    @Inject private Location2IDIndex index;
    @Inject private AlgorithmPreparation prepare;

    @Override
    public void doGet(HttpServletRequest req, HttpServletResponse res) throws ServletException, IOException {
        try {
            if ("/bounds".equals(req.getPathInfo()))
                writeBounds(req, res);
            else
                writePath(req, res);
        } catch (JSONException ex) {
            logger.error("Error while returning bounds", ex);
            writeError(res, SC_INTERNAL_SERVER_ERROR, "Problem occured:" + ex.getMessage());
        }
    }

    void writeBounds(HttpServletRequest req, HttpServletResponse res) throws JSONException {
        BBox bb = graph.getBounds();
        List<Double> list = new ArrayList<Double>(4);
        list.add(bb.minLon);
        list.add(bb.minLat);
        list.add(bb.maxLon);
        list.add(bb.maxLat);
        JSONBuilder json = new JSONBuilder().object("bbox", list);
        writeJson(req, res, json.build());
    }

    void writePath(HttpServletRequest req, HttpServletResponse res) throws JSONException {
        try {
            String fromParam = getParam(req, "from");
            String[] fromStrs = fromParam.split(",");
            double fromLat = Double.parseDouble(fromStrs[0]);
            double fromLon = Double.parseDouble(fromStrs[1]);

            String toParam = getParam(req, "to");
            String[] toStrs = toParam.split(",");
            double toLat = Double.parseDouble(toStrs[0]);
            double toLon = Double.parseDouble(toStrs[1]);

            // we can reduce the path length based on the maximum distance moving away from the original coordinates
            double acceptedMaxDistance = 1;
            try {
                acceptedMaxDistance = Double.parseDouble(getParam(req, "maxReduction"));
            } catch (Exception ex) {
            }
            try {
                StopWatch sw = new StopWatch().start();
                int from = index.findID(fromLat, fromLon);
                int to = index.findID(toLat, toLon);
                float idLookupTime = sw.stop().getSeconds();

                sw = new StopWatch().start();
//            Path p = calcPath(from, to);
                Path p = calcPreparedGraphPath(from, to);
                float routeLookupTime = sw.stop().getSeconds();
                String infoStr = req.getRemoteAddr() + " " + req.getLocale() + " " + req.getHeader("User-Agent");
                int origNodes = p.nodes();
                if (p.found()) {
                    p.simplify(new DouglasPeucker(graph).setMaxDist(acceptedMaxDistance));
                    infoStr += " path found";
                } else
                    infoStr += " NO path found";

                int nodes = p.nodes();
                double dist = p.distance() / 1000;
                int time = Math.round(p.time() / 60f);
                String type = getParam(req, "type");
                if ("bin".equals(type)) {
                    // for type=bin we cannot do jsonp so do:
                    res.setHeader("Access-Control-Allow-Origin", "*");
                    DataOutputStream stream = new DataOutputStream(res.getOutputStream());
                    // write magix number
                    stream.writeInt(123456);
                    // took
                    stream.writeFloat(idLookupTime + routeLookupTime);
                    // distance
                    stream.writeFloat((float) dist);
                    // time
                    stream.writeInt(time);
                    // locations
                    stream.writeInt(nodes);
                    for (int i = 0; i < nodes; i++) {
                        int loc = p.node(i);
                        stream.writeFloat((float) graph.getLatitude(loc));
                        stream.writeFloat((float) graph.getLongitude(loc));
                    }

                    // String points = DatatypeConverter.printBase64Binary(bOut.toByteArray());
                    res.setContentType("arraybuffer");
                    res.setContentLength(stream.size());
                    res.setStatus(200);
                } else {
                    ArrayList<Double[]> points = new ArrayList<Double[]>(nodes);
                    for (int i = 0; i < nodes; i++) {
                        int loc = p.node(i);
                        // geoJson is LON,LAT!
                        points.add(new Double[]{
                                    graph.getLongitude(loc),
                                    graph.getLatitude(loc)
                                });
                    }
                    JSONBuilder json = new JSONBuilder().
                            startObject("info").
                            object("took", idLookupTime + routeLookupTime).
                            object("lookupTime", idLookupTime).
                            object("routeTime", routeLookupTime).
                            endObject().
                            startObject("route").
                            object("from", new Double[]{fromLon, fromLat}).
                            object("to", new Double[]{toLon, toLat}).
                            object("distance", dist).
                            object("time", time).
                            startObject("data").
                            object("type", "LineString").
                            object("coordinates", points).
                            endObject().
                            endObject();

                    writeJson(req, res, json.build());
                }

                logger.info(infoStr + " " + fromLat + "," + fromLon + "->" + toLat + "," + toLon
                        + ", distance: " + dist + ", time:" + time + "min, nodes:" + nodes
                        + " (" + origNodes + "), routeLookupTime:" + routeLookupTime
                        + ", idLookupTime:" + idLookupTime);
            } catch (Exception ex) {
                logger.error("Error while query:" + fromLat + "," + fromLon + "->" + toLat + "," + toLon, ex);
                writeError(res, SC_INTERNAL_SERVER_ERROR, "Problem occured:" + ex.getMessage());
            }
        } catch (NumberFormatException ex) {
            JSONBuilder json = new JSONBuilder().object("error",
                    "Problem while parsing 'from' or 'to' parameter:" + ex.getMessage());
            writeResponse(res, json.build().toString(2));
        }
    }

    protected String getParam(HttpServletRequest req, String string) {
        String[] l = req.getParameterMap().get(string);
        if (l != null && l.length > 0)
            return l[0];
        return "";
    }

    public void writeError(HttpServletResponse res, int code, String str) {
        try {
            res.sendError(code, str);
        } catch (IOException ex) {
            logger.error("Cannot write error " + code + " message:" + str, ex);
        }
    }

    public void writeResponse(HttpServletResponse res, String str) {
        try {
            res.setStatus(SC_OK);
            res.getWriter().append(str);
        } catch (IOException ex) {
            logger.error("Cannot write message:" + str, ex);
        }
    }

    private Path calcPath(int from, int to) {
        // every request create a new independent algorithm instance (not thread safe!)
        AStar algo = new AStar(graph);
        return algo.setApproximation(false).setType(FastestCarCalc.DEFAULT).calcPath(from, to);
    }

    private Path calcPreparedGraphPath(int from, int to) {
        return prepare.createAlgo().calcPath(from, to);
    }

    private void writeJson(HttpServletRequest req, HttpServletResponse res, JSONObject json) throws JSONException {
        String type = getParam(req, "type");
        if ("jsonp".equals(type)) {
            res.setContentType("application/javascript");
            String callbackName = getParam(req, "callback");
            if ("true".equals(getParam(req, "debug")))
                writeResponse(res, callbackName + "(" + json.toString(2) + ")");
            else
                writeResponse(res, callbackName + "(" + json.toString() + ")");
        } else {
            res.setContentType("application/json");
            if ("true".equals(getParam(req, "debug")))
                writeResponse(res, json.toString(2));
            else
                writeResponse(res, json.toString());
        }
    }
}
