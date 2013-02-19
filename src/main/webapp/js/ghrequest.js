GHRequest = function(str) {
    this.minPathPrecision = 1;
    if(!str)
        str = "";
    this.from = new GHInput(str);
    this.to = new GHInput(str);
}

GHRequest.prototype.doRequest = function(host, demoUrl, callback) {
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

function createCallback(errorFallback) {
    return function(err) {
        if(err.statusText && err.statusText != "OK")
            alert(err.statusText);
        else
            alert(errorFallback);
    
        console.log(errorFallback + " " +JSON.stringify(err));
    };
}

GHInput = function(str) { 
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
};

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
