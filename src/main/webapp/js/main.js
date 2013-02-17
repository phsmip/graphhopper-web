// fixing cross domain support e.g in Opera
jQuery.support.cors = true;

var nominatim = "http://open.mapquestapi.com/nominatim/v1/search.php";
var nominatim_reverse = "http://open.mapquestapi.com/nominatim/v1/reverse.php";
// var nominatim = "http://nominatim.openstreetmap.org/search";
// var nominatim_reverse = "http://nominatim.openstreetmap.org/reverse";
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
var clickToRoute;
var iconTo = L.icon({
    iconUrl: './img/marker-to.png', 
    iconAnchor: [10, 16]
});
var iconFrom = L.icon({
    iconUrl: './img/marker-from.png', 
    iconAnchor: [10, 16]
});

var bounds = {};

GHInput = function (str){ 
    // either text or coordinates
    this.input = str;
    this.resolvedText = "";
    try {
        var index = str.indexOf(",");        
        if(index >= 0) {              
            this.lat = round(parseFloat(str.substr(0, index)));
            this.lng = round(parseFloat(str.substr(index + 1)));
            this.input = this.toString();
        }
    } catch(ex) {        
    }
}
GHInput.prototype.setCoord = function(lat,lng) {
    this.resolvedText = "";
    this.lat = round(lat);
    this.lng = round(lng);
    this.input = this.lat + "," + this.lng;
};
GHInput.prototype.toString = function() {
    if(this.lat && this.lng)
        return this.lat + "," + this.lng;
    return null;
};

var ghRequest = {
    minPathPrecision : 1,
    from : new GHInput(""), 
    to: new GHInput("")
}

LOCAL = true;
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
            ghRequest.minPathPrecision = params.minPathPrecision;
        if(params.point && params.point.length == 2)
            resolveCoords(params.point[0], params.point[1]);        
    })
});

function resolveCoords(fromStr, toStr) { 
    routingLayer.clearLayers();
    if(fromStr != ghRequest.from.input)
        ghRequest.from = new GHInput(fromStr);
    
    if(toStr != ghRequest.to.input)
        ghRequest.to = new GHInput(toStr);
    
    if(ghRequest.from.lat && ghRequest.to.lat) {
        // do not wait for resolve
        resolveFrom();
        resolveTo();
        routeLatLng(ghRequest);
    } else {
        // wait for resolve as we need the coord for routing     
        $.when(resolveFrom(), resolveTo()).done(function(fromArgs, toArgs) {                
            routeLatLng(ghRequest);
        });    
    }
}

function initMap() {
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
    clickToRoute = true;
    function onMapClick(e) {        
        if(clickToRoute) {
            // set start point
            routingLayer.clearLayers();
            clickToRoute = false;
            ghRequest.from.setCoord(e.latlng.lat, e.latlng.lng);
            resolveFrom();            
        } else {
            // set end point
            ghRequest.to.setCoord(e.latlng.lat, e.latlng.lng);
            resolveTo();            
            // do not wait for resolving
            routeLatLng(ghRequest);            
        }
    }

    map.on('click', onMapClick);       
}

function setFlag(latlng, isFrom) {
    if(latlng.lat) {
        L.marker([latlng.lat, latlng.lng], {
            icon: (isFrom? iconFrom : iconTo)
        }).addTo(routingLayer).bindPopup(isFrom? "Start" : "End");                  
    } 
}

function resolveFrom() {    
    setFlag(ghRequest.from, true);
    return resolve("from", ghRequest.from);    
}

function resolveTo() {    
    setFlag(ghRequest.to, false);
    return resolve("to", ghRequest.to);    
}

function resolve(fromOrTo, point) {
    $("#" + fromOrTo + "Flag").hide();
    $("#" + fromOrTo + "Indicator").show();
    return getInfoFromLocation(point).done(function() {        
        $("#" + fromOrTo + "Input").val(point.input);
        if(point.resolvedText)
            $("#" + fromOrTo + "Found").html(point.resolvedText);
        
        $("#" + fromOrTo + "Flag").show();
        $("#" + fromOrTo + "Indicator").hide();
        return point;
    })   
}

var getInfoTmpCounter = 0;
function getInfoFromLocation(locCoord) {
    if(locCoord.resolvedText) {
        var tmpDefer = $.Deferred();
        tmpDefer.resolve([locCoord]);
        return tmpDefer;   
    }
        
    // Every call to getInfoFromLocation needs to get its own callback. Sadly we need to overwrite 
    // the callback method name for nominatim and cannot use the default jQuery behaviour.
    getInfoTmpCounter++;
    var url;
    if(locCoord.lat && locCoord.lng) {
        // in every case overwrite name
        locCoord.resolvedText = "Error while looking up coordinate";
        url = nominatim_reverse + "?lat=" + locCoord.lat + "&lon="
        + locCoord.lng + "&format=json&zoom=16&json_callback=reverse_callback" + getInfoTmpCounter;
        return $.ajax({
            url: url,
            type : "GET",
            dataType: "jsonp",
            timeout: 3000,
            jsonpCallback: 'reverse_callback' + getInfoTmpCounter            
        }).fail(function(err) { 
            // not critical => no alert
            console.err(err);
        }).pipe(function(json) {
            if(!json) {
                locCoord.resolvedText = "No description found for coordinate";
                return [locCoord];
            }
            var address = json.address;
            locCoord.resolvedText = "";
            if(address.road)
                locCoord.resolvedText += address.road + " ";
            if(address.city)
                locCoord.resolvedText += address.city + " ";
            if(address.country)
                locCoord.resolvedText += address.country;            
            
            return [locCoord];
        });        
    } else {
        // see https://trac.openstreetmap.org/ticket/4683 why limit=3 and not 1
        url = nominatim + "?format=json&q=" + encodeURIComponent(locCoord.input)
        +"&limit=3&json_callback=search_callback" + getInfoTmpCounter;
        if(bounds.initialized) {
            // minLon, minLat, maxLon, maxLat => left, top, right, bottom
            url += "&bounded=1&viewbox=" + bounds.minLon + ","+bounds.maxLat + ","+bounds.maxLon +","+ bounds.minLat;
        }
        locCoord.resolvedText = "Error while looking up area description";
        return $.ajax({
            url: url,
            type : "GET",
            dataType: "jsonp",
            timeout: 3000,
            jsonpCallback: 'search_callback' + getInfoTmpCounter
        }).fail(createCallback("[nominatim] Problem while looking up location " + locCoord.input)).
        pipe(function(jsonArgs) {
            var json = jsonArgs[0];
            if(!json) {
                locCoord.resolvedText = "No area description found";                
                return [locCoord];
            }        
            locCoord.resolvedText = json.display_name;
            locCoord.lat = round(json.lat);
            locCoord.lng = round(json.lon);            
            return [locCoord];
        });
    }
}

function routeLatLng(request) {    
    clickToRoute = true;
    $("#info").empty();
    var distDiv = $("<div/>");
    $("#info").append(distDiv);
    
    var from = request.from.toString();
    var to = request.to.toString();
    if(!from || !to) {
        distDiv.html('<small>routing not possible. location(s) not found in the area</small>');
        return;
    }
    
    var url = "?point=" + from + "&point=" + to;
    if(request.minPathPrecision != 1)
        url += "&minPathPrecision=" + request.minPathPrecision;
    History.pushState(request, browserTitle, url);
    doRequest(url, function (json) {        
        if(json.info.routeNotFound) {
            distDiv.html('route not found');            
            return;
        }
        
        var geojsonFeature = {
            "type": "Feature",                   
            // "style": myStyle,                
            "geometry": json.route.data
        };
        routingLayer.clearLayers();
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
                        
            setFlag({
                lat: start[1], 
                lng : start[0]
            }, true);
            setFlag({
                lat: end[1], 
                lng: end[0]
            }, false);
        }

        var tmpTime = round(json.route.time / 60, 1000);
        if(tmpTime > 60) 
            tmpTime = round(tmpTime / 60, 1) + "h " + round(tmpTime % 60, 1) + "min";
        else
            tmpTime = tmpTime % 60+ "min";
        distDiv.html("distance: " + round(json.route.distance, 100) + "km<br/>"
            +"time: " + tmpTime + "<br/>"
            +"took: " + round(json.info.took, 1000) + "s<br/>"
            +"points: " + json.route.data.coordinates.length); 
        $("#info").append(distDiv);
        var osrmLink = $("<a>OSRM</a> ");
        osrmLink.attr("href", "http://map.project-osrm.org/?loc=" + from + "&loc=" + to);
        $("#info").append(osrmLink);
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
    var encodedPolyline = true;
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
    console.log(url);    
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
            if(to == "To") {
                resolveTo();
            } else 
                resolveCoords($("#fromInput").val(), to);
        }
    });
    
    // if TO will be submitted
    $('#toInput').keyup(function(e) {
        if(e.which == 10 || e.which == 13) {
            var from = $("#fromInput").val();            
            if(from == "From")  {
                resolveFrom();
            } else
                resolveCoords(from, $("#toInput").val());
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