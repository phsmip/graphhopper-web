package com.graphhopper.http;

import com.google.inject.AbstractModule;
import com.graphhopper.reader.OSMReader;
import com.graphhopper.routing.util.AlgorithmPreparation;
import com.graphhopper.storage.Graph;
import com.graphhopper.storage.Location2IDIndex;
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
//        String area = "bayern";
        String area = "unterfranken";
//        String area = "oberfranken";
//        String area = "germany";
        String graphhopperLoc = path + area + "-gh";
        CmdArgs args = new CmdArgs().put("osmreader.osm", path + area + ".osm").
                put("osmreader.graph-location", graphhopperLoc).
                put("osmreader.locationIndexCapacity", "200000").
                put("osmreader.levelgraph", "true").
                put("osmreader.chShortcuts", "fastest");

        try {
            OSMReader reader = OSMReader.osm2Graph(args);
            bind(Graph.class).toInstance(reader.getGraph());
            bind(AlgorithmPreparation.class).toInstance(reader.getPreparation());
            bind(Location2IDIndex.class).toInstance(reader.getLocation2IDIndex());
        } catch (Exception ex) {
            throw new RuntimeException("cannot initialize graph", ex);
        }
    }
}
