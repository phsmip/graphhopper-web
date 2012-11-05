var routingLayer;
var map;
var browserTitle = "GraphHopper Web Demo";
var errCallback = function(err) {
    alert("error:"+ err.statusText + ", " + err.responseText);
};
var jsonType = false;
var bounds;
var currentCenter = {
    lat : 0, 
    lng : 0
};

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
    initMap(requestCenter());
    initFromParams(parseUrlWithHisto());
});
            
function initFromParams(paramMap) {    
    var from = setFrom(paramMap.from);
    var to = setTo(paramMap.to);
    if(from && to)
        routeLatLng(from, to);
}

function initMap(center) {
    console.log("init map at " + toStr(center));
    map = L.map('map', {
        center: [center.lat, center.lng],
        zoom: 10
    });
    L.tileLayer('http://{s}.tile.cloudmade.com/{key}/{styleId}/256/{z}/{x}/{y}.png', {
        key: '43b079df806c4e03b102055c4e1a8ba8',
        styleId: 997
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
            setTo(endPoint);
            routeLatLng(toLatLng($("#fromInput").val()), endPoint);            
        } else {
            popup.setLatLng(e.latlng).setContent("Start").openOn(map);            
            $("#fromInput").val(toStr(e.latlng));
            setFrom(e.latlng);
        }
    }

    map.on('click', onMapClick);
}

function toStr(latlng) {
    return latlng.lat + "," + latlng.lng;
}

function toLatLng(str) {    
    try {
        var index = str.indexOf(",");
        if(index < 0)
            return undefined;
        var from = {};
        from.lat = round(parseFloat(str.substr(0, index)));
        from.lng = round(parseFloat(str.substr(index + 1)));
        return from;
    } catch(ex) {
        return undefined;
    }
}

function setFrom(tmp) {
    tmp = getInfoFromLocation(tmp);
    if(tmp) {        
        $("#fromFound").html(tmp.name);
    }
    return tmp;
}
function setTo(tmp) {
    tmp = getInfoFromLocation(tmp);
    if(tmp) {
        $("#toFound").html(tmp.name);
    }
    return tmp;
}
function getInfoFromLocation(loc) {
    var info = {
        name: "No area description found", 
        lat: 0, 
        lng: 0
    }
    var latLngLoc = toLatLng(loc);
    if(latLngLoc) {        
        info.lat = latLngLoc.lat;
        info.lng = latLngLoc.lng;
        var url = "http://nominatim.openstreetmap.org/reverse?lat=" + latLngLoc.lat + "&lon="
        + latLngLoc.lng + "&format=json&zoom=16";
        $.ajax({
            "url": url,
            "async": false,
            "success": function(json) {
                if(!json || json.length == 0)
                    return;
                var address = json.address;
                info.name = "";
                if(address.road)
                    info.name += address.road + " ";
                if(address.city)
                    info.name += address.city + " ";
                if(address.country)
                    info.name += address.country;
            },
            "error" : errCallback,
            "type" : "GET",
            "dataType" : "json"
        });        
    } else {    
        var url = "http://nominatim.openstreetmap.org/search?format=json&q=" + encodeURIComponent(loc);
        if(bounds) {
            // minLon, minLat, maxLon, maxLat => left, top, right, bottom
            url += "&bounded=1&viewbox=" + bounds[0] + ","+bounds[3] + ","+bounds[2] +","+ bounds[1];
        }
        
        $.ajax({
            "url": url,
            "async": false,
            "success": function(json) {
                if(!json || json.length == 0)
                    return;
                info.name = json[0].display_name;
                info.lat = round(json[0].lat);
                info.lng = round(json[0].lon);
            },
            "error" : errCallback,
            "type" : "GET",
            "dataType" : "json"
        });
    }
    return info;
}
function round(val, precision) {
    if(!precision)
        precision = 1e6;
    return Math.round(val * precision) / precision;
}
function routeLatLng(from, to) {
    routingLayer.clearLayers();
    from = toStr(from);
    to = toStr(to);
    doRequest(from, to, function (json) {
                
        // json.route.data needs to be in geoJson format => where a points is LON,LAT!
        // http://leaflet.cloudmade.com/examples/geojson.html
        // some more code for geoJson
        // https://github.com/CloudMade/Leaflet/issues/327
        // https://github.com/CloudMade/Leaflet/issues/822
        var myStyle = {
            "color": 'blue',
            "weight": 5,
            "opacity": 0.55
        };

        var geojsonFeature = {
            "type": "Feature",                   
            // "style": myStyle,                
            "geometry": json.route.data
        };
        routingLayer.addData(geojsonFeature);
        
        $("#info").empty();
        var distDiv = $("<div/>");
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
        
        $("#fromInput").val(from);
        $("#toInput").val(to);
        $('.defaulting').each(function(index, element) {
            $(element).css("color", "black");
        });
    });
}

function doRequest(from, to, callback) {
    // http://localhost:8989/api?from=52.439688,13.276863&to=52.532932,13.479424
    var host = location.protocol + "//" + location.host;    
    var demoUrl = "?from=" + from + "&to=" + to;
    var url;
    if(jsonType) {
        url = host + "/api" + demoUrl + "&type=json"; // &debug=true
        $.ajax({
            "url" : url, 
            "success": callback,
            "error" : errCallback,
            "type" : "GET",
            "dataType" : "json"
        });
    } else {
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
    }
    History.pushState({}, browserTitle, demoUrl);
    console.log(url);    
}

function requestCenter() {
    var host = location.protocol + "//" + location.host;    
    var url = host + "/api/bounds";
    console.log(url);    
    $.ajax({
        "url": url,
        "async": false,
        "success": function(json) {
            bounds = json.bbox;
            var minLon = bounds[0];
            var minLat = bounds[1];
            var maxLon = bounds[2];
            var maxLat = bounds[3];
            currentCenter.lat = (minLat + maxLat) / 2;
            currentCenter.lng = (minLon + maxLon) / 2;
        },
        "error" : errCallback,
        "type" : "GET",
        "dataType" : "json"
    });
    
    return currentCenter;
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
            var from = setFrom($("#fromInput").val());
            var to = toLatLng($("#toInput").val());
            routeLatLng(from, to);
        }
    });
    
    // if TO will be submitted
    $('#toInput').keypress(function(e) {
        if(e.which == 10 || e.which == 13) {
            var from = toLatLng($("#fromInput").val());
            var to = setTo($("#toInput").val());
            routeLatLng(from, to);
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