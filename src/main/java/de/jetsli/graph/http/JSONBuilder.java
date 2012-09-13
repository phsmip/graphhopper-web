/*
 * Pannous Confidential
 *
 * Copyright 2012 Pannous GmbH.
 *
 * NOTICE:  All information contained herein is, and remains
 * the property of Pannous GmbH and its suppliers, if any.
 * The intellectual and technical concepts contained herein 
 * are proprietary to Pannous GmbH and its suppliers, and
 * are protected by trade secret or copyright law.
 * Dissemination of this information or reproduction of this 
 * material is strictly forbidden unless prior written 
 * permission is obtained from Pannous GmbH.
 */
package de.jetsli.graph.http;

import java.util.HashMap;
import java.util.Map;
import org.json.JSONObject;

/**
 * @author Peter Karich
 */
public class JSONBuilder {

    private String lastObjectName;
    private JSONBuilder parent;
    private Map map;

    public JSONBuilder() {
        map = new HashMap(5);
    }

    public JSONBuilder setParent(JSONBuilder p) {
        parent = p;
        return this;
    }

    public JSONBuilder startObject(String entry) {
        lastObjectName = entry;
        return new JSONBuilder().setParent(this);
    }

    public JSONBuilder endObject() {
        if (parent == null)
            throw new IllegalStateException("object not opened?");

        parent.map.put(parent.lastObjectName, map);
        parent.lastObjectName = null;
        return parent;
    }

    public JSONBuilder object(String key, Object val) {
        map.put(key, val);
        return this;
    }

    public JSONObject build() {
        if (parent != null || lastObjectName != null)
            throw new IllegalStateException("json with name " + lastObjectName + " not closed");

        return new JSONObject(map);
    }
}
