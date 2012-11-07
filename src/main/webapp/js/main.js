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
var bounds;
// cross origin:
var host = "http://217.92.216.224:8080";
    
// local development
// var host = "http://localhost:8989";

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
    requestCenter().done(function(){
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
    setFrom(from).done(function(fromArgs) {        
        setTo(to).done(function(toArgs) {    
            routeLatLng(fromArgs[0], toArgs[0], true);
        })
    });    
}

function initMap() {
    var center = getCenter(bounds);
    console.log("init map at " + toStr(center));
    map = L.map('map', {
        center: [center.lat, center.lng],
        zoom: 10        
    });
    
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
    // TODO limit area to underlying routing graph bounds!
    // map.setMaxBounds( <LatLngBounds> bounds ) 
    
    var popup = L.popup();    
    var routeNow = true;
    function onMapClick(e) {        
        routeNow = !routeNow;
        if(routeNow) {            
            popup.setLatLng(e.latlng).setContent("End").openOn(map);
            var endPoint = e.latlng;
            toCoord.lat = round(endPoint.lat);
            toCoord.lng = round(endPoint.lng);
            toCoord.input = toStr(toCoord);            
            toCoord.resolved = false;
            setTo().done(function() {
                routeLatLng(fromCoord, toCoord);
            });            
        } else {
            popup.setLatLng(e.latlng).setContent("Start").openOn(map);            
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

function getInfoFromLocation(locCoord) {
    if(locCoord.resolved) {
        var tmpDefer = $.Deferred();
        tmpDefer.resolve([locCoord]);
        return tmpDefer;   
    }
        
    if(locCoord.lat && locCoord.lng) {
        // in every case overwrite name
        locCoord.name = "Error while looking up coordinate";
        var url = "http://nominatim.openstreetmap.org/reverse?lat=" + locCoord.lat + "&lon="
        + locCoord.lng + "&format=json&zoom=16&json_callback=reverse_callback";
        return $.ajax({
            "url": url,
            "error" : errCallback,
            "type" : "GET",
            "dataType": "jsonp",
            "jsonpCallback": 'reverse_callback'
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
        +"&json_callback=search_callback&limit=1";
        if(bounds) {
            // minLon, minLat, maxLon, maxLat => left, top, right, bottom
            url += "&bounded=1&viewbox=" + bounds[0] + ","+bounds[3] + ","+bounds[2] +","+ bounds[1];
        }
        locCoord.name = "Error while looking up area description";
        return $.ajax({
            "url": url,            
            "type" : "GET",
            "dataType": "jsonp",
            "jsonpCallback": 'search_callback'
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
        distDiv.html('<small>routing not possible. location(s) not found in area<br/> ' + bounds + "</small>");
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
            var point = coords[0];
            map.panTo({
                "lng" : point[0], 
                "lat" : point[1]
            });                
        }
                
        distDiv.html("distance: " + round(json.route.distance, 1000) + "km<br/>"
            +"time: " + json.route.time + "min<br/>"
            +"took: " + round(json.info.took, 1000) + "s"); 
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

function requestCenter() {
    var url = host + "/api/bounds?type=jsonp";
    console.log(url);    
    return $.ajax({
        "url": url,
        "success": function(json) {
            bounds = json.bbox;                      
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
    if(bounds) {
        var minLon = bounds[0];
        var minLat = bounds[1];
        var maxLon = bounds[2];
        var maxLat = bounds[3];
        center.lat = (minLat + maxLat) / 2;
        center.lng = (minLon + maxLon) / 2;  
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
            // do not resolve
            if(toCoord.input == to) to = null;
            resolveCoords($("#fromInput").val(), to);
        }
    });
    
    // if TO will be submitted
    $('#toInput').keypress(function(e) {
        if(e.which == 10 || e.which == 13) {
            var from = $("#fromInput").val();
            // do not resolve
            if(toCoord.input == from) from = null;
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