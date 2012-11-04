package com.graphhopper.http;

import com.google.inject.Guice;
import com.google.inject.Injector;
import com.google.inject.Module;
import com.google.inject.Singleton;
import com.google.inject.servlet.GuiceServletContextListener;
import com.google.inject.servlet.ServletModule;
import java.util.HashMap;
import java.util.Map;
import org.eclipse.jetty.servlets.GzipFilter;

/**
 * Replacement of web.xml
 *
 * http://code.google.com/p/google-guice/wiki/ServletModule
 *
 * @author Peter Karich, pkarich@pannous.info
 */
public class GuiceServletConfig extends GuiceServletContextListener {

    @Override protected Injector getInjector() {
        return Guice.createInjector(createDefaultModule(), createServletModule());
    }

    protected Module createDefaultModule() {
        return new DefaultModule();
    }

    protected Module createServletModule() {
        return new ServletModule() {
            @Override protected void configureServlets() {                
                Map<String, String> params = new HashMap<String, String>();
                params.put("mimeTypes", "text/html,"
                        + "text/plain,"
                        + "text/xml,"
                        + "application/xhtml+xml,"
                        + "text/css,"
                        + "application/json,"
                        + "application/javascript,"
                        + "image/svg+xml");

                filter("/*").through(MyGZIPHook.class, params);
                bind(MyGZIPHook.class).in(Singleton.class);
                
                serve("/api*").with(GraphHopperServlet.class);
                bind(GraphHopperServlet.class).in(Singleton.class);
            }
        };
    }
}
