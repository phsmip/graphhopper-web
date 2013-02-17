// fixing cross domain support e.g in Opera
jQuery.support.cors = true;

var routingLayer;
var map;
var browserTitle = "GraphHopper Web Demo";
function createCallback(errorFallback) {
    return function(err) {
        if(err.statusText && err.statusText != "OK")
            alert(err.statusText);
        else
            alert(errorFallback);
    
        console.log(errorFallback + " " +JSON.stringify(err));
    };
}
var minPathPrecision = 1;
var fromCoord = {
    input: "", 
    name: ""
};
var toCoord = {
    input: "", 
    name: ""
};
var iconTo = L.icon({
    iconUrl: './img/marker-to.png', 
    iconAnchor: [10, 16]
});
var iconFrom = L.icon({
    iconUrl: './img/marker-from.png', 
    iconAnchor: [10, 16]
});
var bounds = {};

LOCAL=true;
var host;
if(LOCAL)
    host = "http://localhost:8989";
else {
    // cross origin:
    host = "http://217.92.216.224:8080";
}

$(document).ready(function(e) {
    // I'm really angry about you history.js :/ (triggering double events) ... but let us just use the url rewriting thing
    //    var History = window.History;
    //    if (History.enabled) {
    //        History.Adapter.bind(window, 'statechange', function(){
    //            var state = History.getState();
    //            console.log(state);            
    //            initFromParams(parseUrl(state.url));
    //        });
    //    }
    initForm();
    requestBounds().done(function(){
        initMap();
        var params = parseUrlWithHisto()        
        if(params.minPathPrecision)
            minPathPrecision = params.minPathPrecision;        
        if(params.point && params.point.length == 2)
            freshRouting(params.point[0], params.point[1]);
    })
});

function initMap() {
    // var center = getCenter(bounds);
    console.log("init map at " + JSON.stringify(bounds));
    map = L.map('map');
    map.fitBounds(new L.LatLngBounds(new L.LatLng(bounds.minLat, bounds.minLon), new L.LatLng(bounds.maxLat, bounds.maxLon)));
    
    // cloudmade provider:
    //    L.tileLayer('http://{s}.tile.cloudmade.com/{key}/{styleId}/256/{z}/{x}/{y}.png', {
    //        key: '43b079df806c4e03b102055c4e1a8ba8',
    //        styleId: 997
    //    }).addTo(map);

    // mapquest provider:
    var mapquestUrl = 'http://{s}.mqcdn.com/tiles/1.0.0/osm/{z}/{x}/{y}.png',
    subDomains = ['otile1','otile2','otile3','otile4'],
    mapquestAttrib = 'Data provided by <a href="http://www.openstreetmap.org/" target="_blank">OpenStreetMap</a>,'
    +'<a href="http://open.mapquest.co.uk" target="_blank">MapQuest</a> and contributors. '
    +'Geocoder by <a href="http://wiki.openstreetmap.org/wiki/Nominatim">Nominatim</a>';
    L.tileLayer(mapquestUrl, {
        attribution: mapquestAttrib, 
        subdomains: subDomains
    }).addTo(map);
    var myStyle = {
        "color": 'black',
        "weight": 2,
        "opacity": 0.3
    };
    var geoJson = {
        "type": "Feature",        
        "geometry": {            
            "type": "LineString",
            "coordinates":[[bounds.minLon, bounds.minLat], [bounds.maxLon, bounds.minLat], 
            [bounds.maxLon, bounds.maxLat], [bounds.minLon, bounds.maxLat],
            [bounds.minLon, bounds.minLat]]
        }
    };
    L.geoJson(geoJson, {
        "style": myStyle
    }).addTo(map); 
    
    routingLayer = L.geoJson().addTo(map);
    var routeNow = true;    
    function onMapClick(e) {        
        routeNow = !routeNow;
        if(routeNow) {            
            var endPoint = e.latlng;            
            toCoord.lat = round(endPoint.lat);
            toCoord.lng = round(endPoint.lng);
            toCoord.input = toStr(toCoord);
            toCoord.resolved = false;            
            flagTo(toCoord.lat, toCoord.lng);
            freshRouting(fromCoord.input, toCoord.input);
        } else {
            routingLayer.clearLayers();
            fromCoord.lat = round(e.latlng.lat);
            fromCoord.lng = round(e.latlng.lng);
            fromCoord.input = toStr(fromCoord);
            fromCoord.resolved = false;
            flagFrom(fromCoord.lat, fromCoord.lng);
        }
    }

    map.on('click', onMapClick);       
}

function flagTo(lat, lng) {
    L.marker([lat, lng], {
        icon: iconTo
    }).addTo(routingLayer).bindPopup("End");
}
function flagFrom(lat, lng) {
    L.marker([lat, lng], {
        icon: iconFrom
    }).addTo(routingLayer).bindPopup("Start");
}

function toStr(latlng) {
    if(latlng)
        return latlng.lat + "," + latlng.lng;
    else
        return "";
}

function toLatLng(str) {    
    var latLng = {
        "name" : str, 
        "input" : str, 
        "resolved" : false
    };
    try {
        var index = str.indexOf(",");        
        if(index >= 0) {              
            latLng.lat = round(parseFloat(str.substr(0, index)));
            latLng.lng = round(parseFloat(str.substr(index + 1)));
        }
    } catch(ex) {        
    }
    return latLng;
}
            
function freshRouting(from, to) {
    $("#fromInput").val(from);
    $("#toInput").val(to);
    fromCoord.input = from;
    toCoord.input = to;
    routeLatLng(fromCoord, toCoord);
}

function routeLatLng(fromPoint, toPoint) {
    $("#info").empty();
    var distDiv = $("<div/>");
    $("#info").append(distDiv);
    
    var from = fromPoint.input;
    var to = toPoint.input;
    var historyUrl = "?point=" + fromPoint.input + "&point=" + toPoint.input;
    if(minPathPrecision != 1)
        historyUrl += "&minPathPrecision=" + minPathPrecision;
    History.pushState({}, browserTitle, historyUrl);
    doRequest(historyUrl, function (json) {
        routingLayer.clearLayers();
        if(json.info.wrongApiVersion) {
            distDiv.html('wrong API version at ' + host);
            return;
        }
        if(json.info.routeNotFound) {
            distDiv.html('route not found');            
            return;
        }
        
        var geojsonFeature = {
            "type": "Feature",                   
            // "style": myStyle,                
            "geometry": json.route.data
        };
        routingLayer.addData(geojsonFeature);        
        var coords = json.route.data.coordinates;
        if(coords && coords.length > 1) {
            var start = coords[0];
            var end = coords[coords.length - 1];
            var minLat = Math.min(start[1], end[1]);
            var minLon = Math.min(start[0], end[0]);
            var maxLat = Math.max(start[1], end[1]);
            var maxLon = Math.max(start[0], end[0]);            
            map.fitBounds(new L.LatLngBounds(new L.LatLng(minLat, minLon), new L.LatLng(maxLat, maxLon)));
            flagFrom(start[1], start[0]);
            flagTo(end[1], end[0]);
        }
                
        distDiv.html("distance: " + round(json.route.distance, 1000) + "km<br/>"
            + "time: " + round(json.route.time / 60, 1000) + "min<br/>"
            + "took <br/>"
            + " <small>&nbsp; routing: " + round(json.info.took, 1000) + "s<br/>"
            + " &nbsp; <a href=\"https://github.com/graphhopper/graphhopper/issues/16\">geocoding</a>: " + round(json.info.tookGeocoding, 1000) 
            + "s</small><br/>"
            + "points: " + json.route.data.coordinates.length); 
        $("#info").append(distDiv);
        // OSRM always needs gps coordinates
//        var osrmLink = $("<a>OSRM</a> ");
//        osrmLink.attr("href", "http://map.project-osrm.org/?loc=" + from + "&loc=" + to);
//        $("#info").append(osrmLink);
        var googleLink = $("<a>Google</a> ");
        googleLink.attr("href", "http://maps.google.com/?q=from:" + from + "+to:" + to);
        $("#info").append(googleLink);
        var bingLink = $("<a>Bing</a> ");        
        bingLink.attr("href", "http://www.bing.com/maps/default.aspx?rtp=adr." + from + "~adr." + to);
        $("#info").append(bingLink);
        $('.defaulting').each(function(index, element) {
            $(element).css("color", "black");
        });
    });
}

function doRequest(demoUrl, callback) {
    var encodedPolyline = false;
    var debug = false
    var url = host + "/api" + demoUrl + "&type=jsonp";
    if(encodedPolyline)
        url += "&encodedPolyline=true";    
    if(debug)
        url += "&debug=true";
    $.ajax({
        "url" : url,
        "success": function(json) {
            // convert encoded polyline stuff to normal json
            if(encodedPolyline) {
                var tmpArray = decodePath(json.route.coordinates, true);                
                json.route.coordinates = null;
                json.route.data = {
                    "type" : "LineString",
                    "coordinates": tmpArray
                };
            }
            callback(json);
        },
        "error" : createCallback("Error while request"),
        "type" : "GET",
        "dataType": "jsonp"
    });
}

function decodePath(encoded, geoJson) {
    var len = encoded.length;
    var index = 0;
    var array = [];
    var lat = 0;
    var lng = 0;

    while (index < len) {
        var b;
        var shift = 0;
        var result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        var deltaLat = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lat += deltaLat;

        shift = 0;
        result = 0;
        do {
            b = encoded.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        var deltaLon = ((result & 1) ? ~(result >> 1) : (result >> 1));
        lng += deltaLon;

        if(geoJson)
            array.push([lng * 1e-5, lat * 1e-5]);
        else
            array.push([lat * 1e-5, lng * 1e-5]);
    }

    return array;
}


function requestBounds() {
    var url = host + "/api/bounds?type=jsonp";
    return $.ajax({
        "url": url,
        "success": function(json) {
            var tmp = json.bbox;  
            bounds.initialized = true;
            bounds.minLon = tmp[0];
            bounds.minLat = tmp[1];
            bounds.maxLon = tmp[2];
            bounds.maxLat = tmp[3];
        },
        "error" : function(e) {
            $('#warn').html('GraphHopper API offline? ' + host);
        },
        "timeout" : 3000,
        "type" : "GET",
        "dataType": 'jsonp'
    });
}

function getCenter(bounds) {    
    var center = {
        lat : 0, 
        lng : 0
    };
    if(bounds.initialized) {
        center.lat = (bounds.minLat + bounds.maxLat) / 2;
        center.lng = (bounds.minLon + bounds.maxLon) / 2;  
    }
    return center;
}

function parseUrlWithHisto() {
    if(window.location.hash) 
        return parseUrl(window.location.hash);
    
    return parseUrl(window.location.search);
}

function parseUrlAndRequest() {
    return parseUrl(window.location.search);
}

function parseUrl(query) {
    var index = query.indexOf('?');
    if(index >= 0)
        query = query.substring(index + 1);
    var res = {};        
    var vars = query.split("&");
    for (var i=0;i < vars.length;i++) {
        var pair = vars[i].split("=");
        if(pair.length > 1 && pair[1] != null)
            pair[1] = decodeURIComponent(pair[1].replace(/\+/g,' '));
                        
        if (typeof res[pair[0]] === "undefined")
            res[pair[0]] = pair[1];
        else if (typeof res[pair[0]] === "string") {
            var arr = [ res[pair[0]], pair[1] ];
            res[pair[0]] = arr;
        } else
            res[pair[0]].push(pair[1]);                   
    } 
    return res;
}

function initForm() {
    $('#locationform').submit(function(e) {
        e.preventDefault();
    });
    
    // if FROM will be submitted
    $('#fromInput').keyup(function(e) {
        if(e.which == 10 || e.which == 13) {
            var to = $("#toInput").val();
            // do not resolve 'to'
            if(to != "To")                 
                freshRouting($("#fromInput").val(), to);
        }
    });
    
    // if TO will be submitted
    $('#toInput').keyup(function(e) {
        if(e.which == 10 || e.which == 13) {
            var from = $("#fromInput").val();
            // do not resolve from
            if(from != "From")
                freshRouting(from, $("#toInput").val());
        }
    });

    $('.defaulting').each(function(index, element) {
        var jqElement = $(element);
        var defaultValue = jqElement.attr('defaultValue');        
        jqElement.focus(function() {
            var actualValue = jqElement.val();
            if (actualValue == defaultValue) {
                jqElement.val('');
                jqElement.css('color', 'black');
            }
        });
        jqElement.blur(function() {
            var actualValue = jqElement.val();
            if (!actualValue) {
                jqElement.val(defaultValue);
                jqElement.css('color', 'gray');
            }
        });
    });
}

function round(val, precision) {
    if(!precision)
        precision = 1e6;
    return Math.round(val * precision) / precision;
}