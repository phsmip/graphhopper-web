package com.graphhopper.http;

import com.google.inject.AbstractModule;
import com.graphhopper.GraphHopper;
import com.graphhopper.util.CmdArgs;
import java.io.IOException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * @author Peter Karich, pkarich@pannous.info
 */
public class DefaultModule extends AbstractModule {

    private Logger logger = LoggerFactory.getLogger(getClass());

    @Override
    protected void configure() {
        try {
            CmdArgs args = CmdArgs.readFromConfig("config.properties");
            String osmFile = args.get("graphhopperweb.osm", "");
            if (osmFile.isEmpty())
                throw new IllegalStateException("OSM file cannot be empty. set it in config.properties");

            try {
                String ghLocation = args.get("graphhopperweb.graph-location", "");
                GraphHopper hopper = new GraphHopper().setGraphHopperLocation(ghLocation);
                hopper.load(osmFile);
                bind(GraphHopper.class).toInstance(hopper);
            } catch (Exception ex) {
                throw new IllegalStateException("Couldn't load graph", ex);
            }
        } catch (IOException ex) {
            throw new IllegalStateException("Couldn't load config file", ex);
        }
    }
}
