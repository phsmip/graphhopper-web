// fixing cross domain support e.g in Opera
jQuery.support.cors = true;

var routingLayer;
var map;
var browserTitle = "GraphHopper Web Demo";
var errCallback = function(err) {
    console.log("error:"+ err.statusText + ", " + err.responseText);
};
var fromCoord = {
    input: "", 
    name: ""
};
var toCoord = {
    input: "", 
    name: ""
};
var bounds = {};
// local development
//var host = "http://localhost:8989";

// cross origin:
var host = "http://217.92.216.224:8080";

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
        if(params.from && params.to) {
            fromCoord = toLatLng(params.from);
            toCoord = toLatLng(params.to);
            resolveCoords();
        }
    })
});
            
function resolveCoords(from, to) {    
    $.when(setFrom(from), setTo(to)).done(function(fromArgs, toArgs) {                
        routeLatLng(fromArgs[0], toArgs[0], true);        
    });    
}

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

    routingLayer = L.geoJson().addTo(map);
    var iconLayer = L.geoJson().addTo(map);
    
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
    // boundsLayer.addData(geojsonFeature);  
    
    // limit area to underlying routing graph bounds!
    // not user friendly as zoom level cannot be increased like one wants
    //    map.setMaxBounds(new L.LatLngBounds(new L.LatLng(bounds.minLat, bounds.minLon), 
    //        new L.LatLng(bounds.maxLat, bounds.maxLon)));
    
    var routeNow = true;
    var iconTo = L.icon({
        iconUrl: '../img/marker-to.png', 
        iconAnchor: [10, 16]
        });
    var iconFrom = L.icon({
        iconUrl: '../img/marker-from.png', 
        iconAnchor: [10, 16]
        });
    function onMapClick(e) {        
        routeNow = !routeNow;
        if(routeNow) {            
            L.marker([e.latlng.lat, e.latlng.lng], {
                icon: iconTo
            }).addTo(iconLayer).bindPopup("Finish");
            var endPoint = e.latlng;
            toCoord.lat = round(endPoint.lat);
            toCoord.lng = round(endPoint.lng);
            toCoord.input = toStr(toCoord);            
            toCoord.resolved = false;
            setTo().done(function() {
                routeLatLng(fromCoord, toCoord);
            });            
        } else {
            iconLayer.clearLayers();
            routingLayer.clearLayers();
            L.marker([e.latlng.lat, e.latlng.lng], {
                icon: iconFrom
            }).addTo(iconLayer).bindPopup("Start");
            fromCoord.lat = round(e.latlng.lat);
            fromCoord.lng = round(e.latlng.lng);
            fromCoord.input = toStr(fromCoord);            
            fromCoord.resolved = false;
            setFrom();
        }
    }

    map.on('click', onMapClick);       
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

function setFrom(coordStr) {
    if(coordStr)    
        fromCoord = toLatLng(coordStr);    
    
    return getInfoFromLocation(fromCoord).done(function() {
        fromCoord.resolved = true;
        $("#fromInput").val(fromCoord.input);
        $("#fromFound").html(fromCoord.name);
        return fromCoord;
    })   
}
function setTo(coordStr) {
    if(coordStr)
        toCoord = toLatLng(coordStr);
    
    return getInfoFromLocation(toCoord).done(function() {
        toCoord.resolved = true;                
        $("#toInput").val(toCoord.input);
        $("#toFound").html(toCoord.name);
        return toCoord;
    })
}

var getInfoTmpCounter = 0;
function getInfoFromLocation(locCoord) {
    if(locCoord.resolved) {
        var tmpDefer = $.Deferred();
        tmpDefer.resolve([locCoord]);
        return tmpDefer;   
    }
        
    // Every call to getInfoFromLocation needs to get its own callback. Sadly we need to overwrite 
    // the callback method name for nominatim and cannot use the default jQuery behaviour.
    getInfoTmpCounter++;
    if(locCoord.lat && locCoord.lng) {
        // in every case overwrite name
        locCoord.name = "Error while looking up coordinate";
        var url = "http://nominatim.openstreetmap.org/reverse?lat=" + locCoord.lat + "&lon="
        + locCoord.lng + "&format=json&zoom=16&json_callback=reverse_callback" + getInfoTmpCounter;
        return $.ajax({
            "url": url,
            "error" : errCallback,
            "type" : "GET",
            "dataType": "jsonp",
            "jsonpCallback": 'reverse_callback' + getInfoTmpCounter
        }).pipe(function(json) {
            if(!json) {
                locCoord.name = "No description found for coordinate";
                return [locCoord];
            }
            var address = json.address;
            locCoord.name = "";
            if(address.road)
                locCoord.name += address.road + " ";
            if(address.city)
                locCoord.name += address.city + " ";
            if(address.country)
                locCoord.name += address.country;            
            locCoord.resolved = true;
            return [locCoord];
        });        
    } else {
        var url = "http://nominatim.openstreetmap.org/search?format=json&q=" + encodeURIComponent(locCoord.input)
        +"&limit=1&json_callback=search_callback" + getInfoTmpCounter;
        if(bounds.initialized) {
            // minLon, minLat, maxLon, maxLat => left, top, right, bottom
            url += "&bounded=1&viewbox=" + bounds.minLon + ","+bounds.maxLat + ","+bounds.maxLon +","+ bounds.minLat;
        }
        locCoord.name = "Error while looking up area description";
        return $.ajax({
            "url": url,            
            "type" : "GET",
            "dataType": "jsonp",
            "jsonpCallback": 'search_callback' + getInfoTmpCounter
        }).pipe(function(jsonArgs) {
            var json = jsonArgs[0];
            if(!json) {
                locCoord.name = "No area description found";                
                return [locCoord];
            }        
            locCoord.name = json.display_name;
            locCoord.lat = round(json.lat);
            locCoord.lng = round(json.lon);
            locCoord.resolved = true;
            return [locCoord];
        });
    }
}

function routeLatLng(fromPoint, toPoint, doPan) {
    routingLayer.clearLayers();
    $("#info").empty();
    var distDiv = $("<div/>");
    $("#info").append(distDiv);
    
    var from = toStr(fromPoint);
    var to = toStr(toPoint);
    if(from.indexOf('undefined') >= 0 || to.indexOf('undefined') >= 0) {
        distDiv.html('<small>routing not possible. location(s) not found in area (marked with orange border)</small>');
        return;
    }
    // do not overwrite input text!
    History.pushState({}, browserTitle, "?from=" + fromPoint.input + "&to=" + toPoint.input);
    doRequest(from, to, function (json) {        
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
        if(doPan && coords && coords.length > 0) {
            var start = coords[0];
            var end = coords[coords.length - 1];
            var minLat = Math.min(start[1], end[1]);
            var minLon = Math.min(start[0], end[0]);
            var maxLat = Math.max(start[1], end[1]);
            var maxLon = Math.max(start[0], end[0]);            
            map.fitBounds(new L.LatLngBounds(new L.LatLng(minLat, minLon), new L.LatLng(maxLat, maxLon)));
        }
                
        distDiv.html("distance: " + round(json.route.distance, 1000) + "km<br/>"
            +"time: " + json.route.time + "min<br/>"
            +"took: " + round(json.info.took, 1000) + "s<br/>"
            +"points: " + json.route.data.coordinates.length); 
        $("#info").append(distDiv);
        var googleLink = $("<a>Google</a>");
        googleLink.attr("href", "http://maps.google.com/?q=from:" + from + "+to:" + to);
        $("#info").append(googleLink);
        var osrmLink = $("<br/><a>OSRM</a>");
        osrmLink.attr("href", "http://map.project-osrm.org/?loc=" + from + "&loc=" + to);
        $("#info").append(osrmLink);        
        $('.defaulting').each(function(index, element) {
            $(element).css("color", "black");
        });
    });
}

function doRequest(from, to, callback) {
    // example: http://localhost:8989/api?from=52.439688,13.276863&to=52.532932,13.479424    
    var demoUrl = "?from=" + from + "&to=" + to;
    var url;
    var arrayBufferSupported = typeof new XMLHttpRequest().responseType === 'string';    
    if(arrayBufferSupported) {
        // we need a very efficient way to get the probably huge number of points
        url = host + "/api" + demoUrl + "&type=bin";             
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.responseType = 'arraybuffer';
        xhr.onload = function(e) {
            if (this.status == 200) {
                var dv = new DataView(this.response);
                var json = {
                    "info" : {
                        "took" : 0
                    },
                    "route": {
                        "time": 0, 
                        "distance": 0, 
                        "data" : {}
                    }
                };
                
                var i = 0;                
                var magix = dv.getInt32(i);
                if(magix != 123456) {
                    json.info.routeNotFound = true;
                    callback(json);                    
                    return;
                }
                i += 4;
                json.info.took = dv.getFloat32(i);                
                i += 4;
                json.route.distance = dv.getFloat32(i);
                i += 4;
                json.route.time = dv.getInt32(i);
                i += 4;
                var locations = dv.getInt32(i);
                var tmpArray = [];
                json.route.data = {
                    "type" : "LineString",
                    "coordinates": tmpArray
                };
                for(var index = 0; index < locations; index ++) {
                    i += 4;
                    var lat = dv.getFloat32(i);
                    i += 4;
                    var lng = dv.getFloat32(i);
                    tmpArray.push([lng, lat]);
                }            
                callback(json);
            } else
                errCallback(e);
        };
        xhr.send();
    } else {
        $("#warn").html('Slowish data retrieval as ArrayBuffer is unsupported in your browser.');
        // TODO use base64 and binary representation of points to reduce downloading
        // or is it sufficient with our recently added gzip compression?
        url = host + "/api" + demoUrl + "&type=jsonp"; // &debug=true
        $.ajax({
            "url" : url,
            "success": callback,
            "error" : errCallback,
            "type" : "GET",
            "dataType": "jsonp"
        });        
    }
    
    console.log(url);    
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
            $('#warn').html('GraphHopper API offline?');
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
    $('#fromInput').keypress(function(e) {
        if(e.which == 10 || e.which == 13) {
            var to = $("#toInput").val();
            // do not resolve 'to'
            if(to == toCoord.input || to == "To") to = null;
            resolveCoords($("#fromInput").val(), to);
        }
    });
    
    // if TO will be submitted
    $('#toInput').keypress(function(e) {
        if(e.which == 10 || e.which == 13) {
            var from = $("#fromInput").val();
            // do not resolve from
            if(from == fromCoord.input || from == "From") from = null;
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