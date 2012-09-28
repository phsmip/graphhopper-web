package de.jetsli.graph.http;

import com.google.inject.AbstractModule;
import de.jetsli.graph.reader.OSMReader;
import de.jetsli.graph.storage.Graph;
import de.jetsli.graph.storage.Location2IDIndex;
import de.jetsli.graph.storage.Location2IDQuadtree;
import de.jetsli.graph.storage.RAMDirectory;
import de.jetsli.graph.util.CmdArgs;

/**
 * @author Peter Karich, pkarich@pannous.info
 */
public class DefaultModule extends AbstractModule {

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

        Location2IDIndex index = new Location2IDQuadtree(graph, 
                new RAMDirectory(graphhopperLoc + "/loc2idIndex")).prepareIndex(200000);
        bind(Location2IDIndex.class).toInstance(index);
    }
}
