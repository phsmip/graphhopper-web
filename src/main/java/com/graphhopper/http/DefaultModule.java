package com.graphhopper.http;

import com.google.inject.AbstractModule;
import com.graphhopper.reader.OSMReader;
import com.graphhopper.storage.Graph;
import com.graphhopper.storage.Location2IDIndex;
import com.graphhopper.storage.Location2IDQuadtree;
import com.graphhopper.storage.RAMDirectory;
import com.graphhopper.util.CmdArgs;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * @author Peter Karich, pkarich@pannous.info
 */
public class DefaultModule extends AbstractModule {

    private Logger logger = LoggerFactory.getLogger(getClass());

    @Override
    protected void configure() {
        String path = "/media/SAMSUNG/maps/";
        String area = "unterfranken";
//        String area = "germany";
        String graphhopperLoc = path + area + "-gh";
        CmdArgs args = new CmdArgs().put("osm", path + area + ".osm").put("graph", graphhopperLoc);
//                .put("dataaccess", "mmap");
        Graph graph;
        try {
            graph = OSMReader.osm2Graph(args);
            bind(Graph.class).toInstance(graph);
        } catch (Exception ex) {
            throw new RuntimeException("cannot initialize graph", ex);
        }

        logger.info("now initializing index");
        Location2IDIndex index = new Location2IDQuadtree(graph,
                new RAMDirectory(graphhopperLoc + "/loc2idIndex")).prepareIndex(200000);
        bind(Location2IDIndex.class).toInstance(index);
    }
}
