/*
 *  Licensed to Peter Karich under one or more contributor license 
 *  agreements. See the NOTICE file distributed with this work for 
 *  additional information regarding copyright ownership.
 * 
 *  Peter Karich licenses this file to you under the Apache License, 
 *  Version 2.0 (the "License"); you may not use this file except 
 *  in compliance with the License. You may obtain a copy of the 
 *  License at
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

import com.graphhopper.search.Geocoding;
import com.graphhopper.util.shapes.GHInfoPoint;
import com.graphhopper.GHRequest;
import com.graphhopper.GraphHopper;
import com.graphhopper.GHResponse;
import com.graphhopper.routing.util.FastestCalc;
import com.graphhopper.routing.util.VehicleEncoder;
import com.graphhopper.routing.util.ShortestCalc;
import com.graphhopper.routing.util.WeightCalculation;
import com.graphhopper.util.Helper;
import com.graphhopper.util.PointList;
import com.graphhopper.util.StopWatch;
import com.graphhopper.util.shapes.BBox;
import com.graphhopper.util.shapes.GHPoint;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import javax.inject.Inject;
import javax.inject.Named;
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
 * Servlet to use GraphHopper in a remote application (mobile or browser).
 * Attention: If type is json it returns the points in GeoJson format
 * (longitude,latitude) unlike the format "lat,lon" used otherwise.
 *
 * @author Peter Karich
 */
public class GraphHopperServlet extends HttpServlet {

    private Logger logger = LoggerFactory.getLogger(getClass());
    @Inject private GraphHopper hopper;
    @Inject private Geocoding geocoding;
    @Inject
    @Named("defaultAlgorithm")
    private String defaultAlgorithm;
    @Inject
    @Named("timeout")
    private Long timeOutInMillis;
    @Inject
    private GHThreadPool threadPool;

    @Override
    public void doGet(HttpServletRequest req, HttpServletResponse res) throws ServletException, IOException {
        try {
            if ("/bounds".equals(req.getPathInfo()))
                writeBounds(req, res);
            else
                writePath(req, res);
        } catch (Exception ex) {
            logger.error("Error while executing request: " + req.getQueryString(), ex);
            writeError(res, SC_INTERNAL_SERVER_ERROR, "Problem occured:" + ex.getMessage());
        }
    }

    void writeBounds(HttpServletRequest req, HttpServletResponse res) throws JSONException {
        BBox bb = hopper.getGraph().bounds();
        List<Double> list = new ArrayList<Double>(4);
        list.add(bb.minLon);
        list.add(bb.minLat);
        list.add(bb.maxLon);
        list.add(bb.maxLat);
        JSONBuilder json = new JSONBuilder().object("bbox", list);
        writeJson(req, res, json.build());
    }

    void writePath(HttpServletRequest req, HttpServletResponse res) throws Exception {
        StopWatch sw = new StopWatch().start();
        List<GHInfoPoint> infoPoints = getPoints(req);
        float tookGeocoding = sw.stop().getSeconds();
        GHPoint start = infoPoints.get(0);
        GHPoint end = infoPoints.get(1);
        // we can reduce the path length based on the maximum differences to the original coordinates
        double minPathPrecision = 1;
        try {
            minPathPrecision = Double.parseDouble(getParam(req, "minPathPrecision"));
        } catch (Exception ex) {
        }
        String vehicleStr = getParam(req, "algoVehicle");
        VehicleEncoder algoVehicle = Helper.getVehicleEncoder(vehicleStr);
        WeightCalculation algoType = new FastestCalc(algoVehicle);
        if ("shortest".equalsIgnoreCase(getParam(req, "algoType")))
            algoType = new ShortestCalc();

        String algoStr = defaultAlgorithm;
        if (!Helper.isEmpty(algoStr))
            algoStr = getParam(req, "algo");

        try {
            if (minPathPrecision <= 0)
                hopper.simplify(false);

            sw = new StopWatch().start();
            GHResponse p = hopper.route(new GHRequest(start, end).
                    vehicle(algoVehicle).type(algoType).
                    algorithm(algoStr).
                    minPathPrecision(minPathPrecision));
            float took = sw.stop().getSeconds();
            String infoStr = req.getRemoteAddr() + " " + req.getLocale() + " " + req.getHeader("User-Agent");
            PointList points = p.points();
            if (p.found())
                infoStr += " path found";
            else
                infoStr += " NO path found";

            double distInKM = p.distance() / 1000;
            String encodedParam = getParam(req, "encodedPolyline");

            JSONBuilder builder = new JSONBuilder().
                    startObject("info").
                    object("took", took).
                    object("tookGeocoding", tookGeocoding).
                    endObject();
            builder = builder.startObject("route").
                    object("from", new Double[]{start.lon, start.lat}).
                    object("to", new Double[]{end.lon, end.lat}).
                    object("distance", distInKM).
                    object("time", p.time());
            if ("true".equals(encodedParam)) {
                String encodedPolyline = WebHelper.encodePolyline(points);
                builder.object("coordinates", encodedPolyline);
            } else {
                builder.startObject("data").
                        object("type", "LineString").
                        object("coordinates", points.toGeoJson()).
                        endObject();
            }
            builder = builder.endObject();

            writeJson(req, res, builder.build());
            logger.info(req.getQueryString() + " " + infoStr + " " + start + "->" + end
                    + ", distance: " + distInKM + ", time:" + Math.round(p.time() / 60f)
                    + "min, points:" + points.size() + ", took:" + took
                    + ", debug - " + p.debugInfo() + ", " + algoStr + ", "
                    + algoType + ", " + algoVehicle);
        } catch (Exception ex) {
            logger.error("Error while query:" + start + "->" + end, ex);
            writeError(res, SC_INTERNAL_SERVER_ERROR, "Problem occured:" + ex.getMessage());
        }
    }

    protected String getParam(HttpServletRequest req, String string) {
        String[] l = req.getParameterMap().get(string);
        if (l != null && l.length > 0)
            return l[0];
        return "";
    }

    protected String[] getParams(HttpServletRequest req, String string) {
        String[] l = req.getParameterMap().get(string);
        if (l != null && l.length > 0)
            return l;
        return new String[0];
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

    private void writeJson(HttpServletRequest req, HttpServletResponse res, JSONObject json) throws JSONException {
        String type = getParam(req, "type");
        res.setCharacterEncoding("UTF-8");
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

    void returnError(HttpServletResponse res, String errorMessage) throws IOException {
        res.sendError(SC_BAD_REQUEST, errorMessage);
    }

    private List<GHInfoPoint> getPoints(HttpServletRequest req) throws IOException {
        String[] pointsAsStr = getParams(req, "point");
        if (pointsAsStr.length == 0) {
            String from = getParam(req, "from");
            String to = getParam(req, "to");
            if (!Helper.isEmpty(from) && !Helper.isEmpty(to))
                pointsAsStr = new String[]{from, to};
        }

        final List<GHInfoPoint> infoPoints = new ArrayList<GHInfoPoint>();
        List<GHThreadPool.GHWorker> workers = new ArrayList<GHThreadPool.GHWorker>();
        for (int pointNo = 0; pointNo < pointsAsStr.length; pointNo++) {
            final String str = pointsAsStr[pointNo];
            try {
                String[] fromStrs = str.split(",");
                if (fromStrs.length == 2) {
                    double fromLat = Double.parseDouble(fromStrs[0]);
                    double fromLon = Double.parseDouble(fromStrs[1]);
                    infoPoints.add(new GHInfoPoint(fromLat, fromLon));
                    continue;
                }
            } catch (Exception ex) {
            }

            final int index = infoPoints.size();
            infoPoints.add(new GHInfoPoint(Double.NaN, Double.NaN).name(str));
            GHThreadPool.GHWorker worker = new GHThreadPool.GHWorker(timeOutInMillis) {
                @Override public String name() {
                    return "geocoding search " + str;
                }

                @Override public void run() {
                    List<GHInfoPoint> tmpPoints = geocoding.search(str);
                    if (!tmpPoints.isEmpty())
                        infoPoints.set(index, tmpPoints.get(0));
                }
            };
            workers.add(worker);
            threadPool.enqueue(worker);
        }
        threadPool.waitFor(workers, timeOutInMillis);
        for (GHInfoPoint p : infoPoints) {
            if (Double.isNaN(p.lat))
                throw new IllegalArgumentException("[nominatim] Not all points could be resolved! " + infoPoints);
        }

        // TODO resolve name in a thread if only lat,lon is given but limit to a certain timeout
        if (infoPoints == null || infoPoints.size() < 2)
            throw new IllegalArgumentException("Did you specify point=<from>&point=<to> ? Use at least 2 points! " + infoPoints);

        // TODO execute algorithm multiple times!
        if (infoPoints.size() != 2)
            throw new IllegalArgumentException("TODO! At the moment max. 2 points has to be specified");

        return infoPoints;
    }
}
