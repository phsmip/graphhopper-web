package de.jetsli.graph.http;

import com.google.inject.Guice;
import com.google.inject.Injector;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.google.inject.servlet.GuiceServletContextListener;
import com.google.inject.servlet.ServletModule;

/**
 * Replacement of web.xml
 *
 * http://code.google.com/p/google-guice/wiki/ServletModule
 *
 * @author Peter Karich, pkarich@pannous.info
 */
public class GuiceServletConfig extends GuiceServletContextListener {

    @Override
    protected Injector getInjector() {
        return Guice.createInjector(createDefaultModule(), createServletModule());
    }

    protected Module createDefaultModule() {
        return new DefaultModule();
    }

    protected Module createServletModule() {
        return new ServletModule() {
            @Override
            protected void configureServlets() {
                serve("/api*").with(GraphHopperServlet.class);
                bind(GraphHopperServlet.class).in(Singleton.class);
            }
        };
    }
}
