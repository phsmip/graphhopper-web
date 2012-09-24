function myinit() {
    var paramMap = parseUrlAndRequest();
    var from = {};        
    if(paramMap.from) {
        try {
            var index = paramMap.from.indexOf(",");
            from.lat = parseFloat(paramMap.from.substr(0, index));
            from.lng = parseFloat(paramMap.from.substr(index + 1));
        } catch(ex) {            
        }
    }
    
    if(!from.lat || !from.lng) {
        from.lat = 52.532932;
        from.lng = 13.4;
    }
    initMap(from);
    if(paramMap.from && paramMap.to)
        route(paramMap.from, paramMap.to);    
}

var routingLayer;
var map;

function initMap(center) {
    map = L.map('map', {
        center: [center.lat, center.lng],
        zoom: 11
    });
    L.tileLayer('http://{s}.tile.cloudmade.com/{key}/{styleId}/256/{z}/{x}/{y}.png', {
        key: '43b079df806c4e03b102055c4e1a8ba8',
        styleId: 997
    }).addTo(map);
    // TODO limit area to underlying routing graph bounds!
    // max.setMaxBounds( <LatLngBounds> bounds ) 
    
    var popup = L.popup();
    var startPoint = null;    
    function onMapClick(e) {        
        if(!startPoint) {
            if(routingLayer)
                routingLayer.clearLayers();
            popup.setLatLng(e.latlng).setContent("Start").openOn(map);
            startPoint = e.latlng;
        } else {
            popup.setLatLng(e.latlng).setContent("End").openOn(map);
            var endPoint = e.latlng;
            route(startPoint.lat + "," + startPoint.lng, endPoint.lat + "," + endPoint.lng);
            startPoint = null;
        }
    }

    map.on('click', onMapClick);
}

function route(start, end) {
    doRequest(start, end, function (json) {
                
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
        routingLayer = L.geoJson().addTo(map);
        routingLayer.addData(geojsonFeature);
                
        $("#info").html("distance in km " + json.route.distance); 
    });
}
function parseUrlAndRequest() {
    var paramMap = function () {
        var res = {};
        var query = window.location.search.substring(1);
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
    } ();    
                             
    return paramMap;
}
            
function doRequest(from, to, callback) {
    // http://localhost:8989/api?from=52.439688,13.276863&to=52.532932,13.479424
    var host = location.protocol + "//" + location.host;
    
    // does not work in chrome
    //    if(location.protocol == "file:")
    //        host = "http://localhost";
                
    var url = host + "/api?from=" + from + "&to=" + to;
    console.log(url);
    $.get(url, callback, "json");
}