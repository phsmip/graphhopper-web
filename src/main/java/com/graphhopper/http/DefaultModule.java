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
                GraphHopper hopper = new GraphHopper().graphHopperLocation(ghLocation);
                if (args.getBool("graphhopperweb.contractionHierarchies", false))
                    hopper.contractionHierarchies(true);
                hopper.forServer().load(osmFile);
                bind(GraphHopper.class).toInstance(hopper);
            } catch (Exception ex) {
                throw new IllegalStateException("Couldn't load graph", ex);
            }
        } catch (IOException ex) {
            throw new IllegalStateException("Couldn't load config file", ex);
        }
    }
}
