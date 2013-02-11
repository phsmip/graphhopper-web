package com.graphhopper.http;

import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URLEncoder;

/**
 * @author Peter Karich
 */
public class WebHelper {

    public static String urlEncode(String str) {
        try {
            return URLEncoder.encode(str, "UTF-8");
        } catch (Exception _ignore) {
            return str;
        }
    }

    public static String readString(InputStream inputStream, String encoding) throws IOException {
        InputStream in = new BufferedInputStream(inputStream, 4096);
        try {
            byte[] buffer = new byte[4096];
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            int numRead;
            while ((numRead = in.read(buffer)) != -1) {
                output.write(buffer, 0, numRead);
            }
            return output.toString(encoding);
        } finally {
            in.close();
        }
    }
}
