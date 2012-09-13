function myinit() {
    initMap();    
    var paramMap = parseUrlAndRequest();
   
    if(paramMap.from && paramMap.to)
        doRequest(paramMap.from, paramMap.to);    
}

function initMap() {
    var map = L.map('map', {
        center: [52.532932,13.4],
        zoom: 12
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
            popup.setLatLng(e.latlng).setContent("Start").openOn(map);
            startPoint = e.latlng;
        } else {
            popup.setLatLng(e.latlng).setContent("End").openOn(map);
            doRequest(startPoint.lat + "," + startPoint.lng, e.latlng.lat + "," + e.latlng.lng, function (json) {
                
                // json.route.data needs to be in geoJson format => where a points is LON,LAT!
//                var myLines = [{
//                    "type": "LineString",
//                    "coordinates": [[13.276863,52.439688], [13.479424,52.532932], [13.47,52.53]]
//                }];

                var myStyle = {
                    "color": 'blue',
                    "weight": 5,
                    "opacity": 0.55
                };

                L.geoJson([json.route.data], {
                    style: myStyle
                }).addTo(map);
            });
            startPoint = null;
        }
    }

    map.on('click', onMapClick);
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