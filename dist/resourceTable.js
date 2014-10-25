/*https://github.com/nurun/resourceTable*/

(function(){

//bookmarklet wide vars
var localResources = [],
	externalResources = [],
	allRessourcesCalc = [],
	fileTypes = [],
	fileTypesBySource = [],
	resources,
	marks,
	perfTiming,
	outputHolder,
	outputContent;

//feature check gate
if(window.performance && window.performance.getEntriesByType !== undefined) {
	resources = window.performance.getEntriesByType("resource");
	marks = window.performance.getEntriesByType("mark");
}else if(window.performance && window.performance.webkitGetEntriesByType !== undefined) {
	resources = window.performance.webkitGetEntriesByType("resource");
	marks = window.performance.webkitGetEntriesByType("mark");
}else{
	alert("Oups, looks like this browser does not support the Ressource Timing API\ncheck http://caniuse.com/#feat=resource-timing to see the ones supporting it \n\n");
	return;
}

if(window.performance.timing){
	perfTiming = window.performance.timing;
}else{
	alert("Oups, looks like this browser does not support performance timing");		
}

//remove this bookmarklet from the result
resources = resources.filter(function(currR){
	return !currR.name.match(/http[s]?\:\/\/nurun.github.io\/resourceTable\/.*/);
});

//helper functions

//creat html tag
var newTag = function(tagName, settings, css){
	settings = settings || {};
	var tag = document.createElement(tagName);
	for(var attr in settings){
		if(attr != "text"){
			tag[attr] = settings[attr];
		}
	}
	tag.textContent = settings.text;
	tag.style.cssText = css || "";
	return tag;
};

//create svg element
var newElementNs = function(tagName, settings, css){
	var el = document.createElementNS("http://www.w3.org/2000/svg", tagName);
	for(var attr in settings){
		if(attr != "text"){
			el.setAttributeNS(null, attr, settings[attr]);
		}
	}
	el.textContent = settings.text;
	el.style.cssText = css || "";
	return el;
};

var newTextElementNs = function(text, y, css){
	return newElementNs("text", {
			fill : "#111",
			y : y,
			text : text
		}, (css||"") + " text-shadow:0 0 2px #fff;");
};

var getNodeTextWidth = function(textNode){
	var tmp = newElementNs("svg:svg", {}, "visibility:hidden;");
	tmp.appendChild(textNode);
	document.body.appendChild(tmp);
	var nodeWidth = textNode.getBBox().width;
	tmp.parentNode.removeChild(tmp);
	return nodeWidth;
};

var getRandomColor = function() {
	var letters = '0123456789ABCDEF'.split(''),
		color = '#';
	for (var i = 0; i < 6; i++ ) {
		color += letters[Math.floor(Math.random() * 16)];
	}
	return color;
};

var getItemCount = function(arr, keyName) {
	var counts = {},
		resultArr = [];

	arr.forEach(function(key){
		counts[key] = counts[key] ? counts[key]+1 : 1;
	});

	//pivot data
	for(var fe in counts){
		obj = {};
		obj[keyName||"key"] = fe;
		obj.count = counts[fe];

		resultArr.push(obj);
	}
	return resultArr.sort(function(a, b) {
		return a.count < b.count ? 1 : -1;
	});
};


// find or create holder element
outputHolder = document.getElementById("resourceTable-holder");
if(!outputHolder){
	outputHolder = newTag("div", {id : "resourceTable-holder"}, "position:absolute; top:0; left:0; z-index: 9999; font:normal 12px/18px sans-serif; padding:1em 1em 3em; background:rgba(255, 255, 255, 1);");
	outputContent = newTag("div", {id : "resourceTable-content"}, "position:relative;");
		
	var closeBtn = newTag("button", {
		id : "resourceTable-close",
		text: "close"
	}, "position:absolute; top:0; right:0; padding:1em 0.5em; z-index:1; background:transparent; border:0;");
	closeBtn.addEventListener("click", function(){
		outputHolder.parentNode.removeChild(outputHolder);
	});

	outputHolder.appendChild(closeBtn);
	outputHolder.appendChild(outputContent);
}else{
	outputContent = document.getElementById("resourceTable-content");
	//clear existing data
	while (outputContent.firstChild) {
		outputContent.removeChild(outputContent.firstChild);
	}
}



//Logic for Request pie charts

function createPieChart(data, size){
	//inpired by http://jsfiddle.net/da5LN/62/

	var chart = newElementNs("svg:svg", {
		width : "100%",
		height : "100%",
		viewBox : "0 0 " + size + " " + size
	});

	var unit = (Math.PI * 2) / 100,
		startAngle = 0; // init startAngle

	var createWedge = function(id, size, percentage, labelTxt, colour){
		var radius = size/2,
			endAngle = startAngle + (percentage * unit - 0.001),
			labelAngle = startAngle + (percentage/2 * unit - 0.001),
			x1 = radius + radius * Math.sin(startAngle),
			y1 = radius - radius * Math.cos(startAngle),
			x2 = radius + radius * Math.sin(endAngle),
			y2 = radius - radius * Math.cos(endAngle),
			x3 = radius + radius * 0.85 * Math.sin(labelAngle),
			y3 = radius - radius * 0.85 * Math.cos(labelAngle),
			big = (endAngle - startAngle > Math.PI) ? 1 : 0;

		var d = "M " + radius + "," + radius +	// Start at circle center
				" L " + x1 + "," + y1 +				// Draw line to (x1,y1)
				" A " + radius + "," + radius +	// Draw an arc of radius r
				" 0 " + big + " 1 " +				// Arc details...
				x2 + "," + y2 +						// Arc goes to to (x2,y2)
				" Z";								// Close path back to (cx,cy)

		var path = newElementNs("path", {
			id : id,
			d : d,
			fill : colour
		});

		path.appendChild(newElementNs("title", {
			text : labelTxt
		})); // Add tile to wedge path
		path.addEventListener("mouseover", function(evt){
			evt.target.setAttribute("fill", "#ccc");
			document.getElementById(evt.target.getAttribute("id") + "-table").style.backgroundColor = "#ccc";
		});
		path.addEventListener("mouseout", function(evt){
			evt.target.setAttribute("fill", colour);
			document.getElementById(evt.target.getAttribute("id") + "-table").style.backgroundColor = "transparent";
		});

		startAngle = endAngle;
		if(percentage > 10){
			var wedgeLabel = newTextElementNs(labelTxt, y3, "pointer-events:none;");

			if(labelAngle < Math.PI){
				wedgeLabel.setAttribute("x", x3 - getNodeTextWidth(wedgeLabel));
			}else{
				wedgeLabel.setAttribute("x", x3);
			}

			return { path: path, wedgeLabel: wedgeLabel};
		}			
		return { path: path };
	};
	
	//setup chart
	var labelWrap = newElementNs("g", {}, "pointer-events: none;");

	//loop through data and create wedges
	data.forEach(function(dataObj){
		var wedgeAndLabel = createWedge(dataObj.id, size, dataObj.perc, dataObj.label + " (" + dataObj.count + ")", getRandomColor());
		chart.appendChild(wedgeAndLabel.path);

		if(wedgeAndLabel.wedgeLabel){
			labelWrap.appendChild(wedgeAndLabel.wedgeLabel);
		}
	});

	// foreground circle
	chart.appendChild(newElementNs("circle", {
		cx : size/2,
		cy : size/2,
		r : size*0.05,
		fill : "#fff"
	}));
	chart.appendChild(labelWrap);
	return chart;
};

var createTable = function(title, data){
	//create table
	var tableHolder = newTag("div", {}, "float:left; width:100%; overflow-x:auto");
	var table = newTag("table", {}, "float:left; width:100%;");
	var thead = newTag("thead");
	var tbody = newTag("tbody");
	thead.appendChild(newTag("th", {text : title}, "text-align: left; padding:0 0.5em 0 0;"));
	thead.appendChild(newTag("th", {text : "Requests"}, "text-align: left; padding:0 0.5em 0 0;"));
	thead.appendChild(newTag("th", {text : "Percentage"}, "text-align: left; padding:0 0.5em 0 0;"));
	table.appendChild(thead);

	data.forEach(function(y){
		var row = newTag("tr", {id : y.id + "-table"});
		row.appendChild(newTag("td", {text : y.label}));
		row.appendChild(newTag("td", {text : y.count}));
		row.appendChild(newTag("td", {text : y.perc.toPrecision(2) + "%"}));
		tbody.appendChild(row);
	});

	table.appendChild(tbody);
	tableHolder.appendChild(table);

	return tableHolder;
};

//crunch the resources data into something easier to work with
allRessourcesCalc = resources.map(function(currR, i, arr){
	var urlFragments = currR.name.match(/:\/\/(.[^/]+)([^?]*)\??(.*)/),
		maybeFileName = urlFragments[2].split("/").pop(),
		fileExtension = maybeFileName.substr((Math.max(0, maybeFileName.lastIndexOf(".")) || Infinity) + 1);
	
	var currRes = {
		name : currR.name,
		domain : urlFragments[1],
		initiatorType : currR.initiatorType || fileExtension || "SourceMap or Not Defined",
		fileExtension : fileExtension || "XHR or Not Defined",
		loadtime : currR.duration,
		isLocalDomain : urlFragments[1] === location.host
	};

	if(currR.requestStart){
		currRes.requestStartDelay = currR.requestStart - currR.startTime;
		currRes.dns = currR.domainLookupEnd - currR.domainLookupStart;
		currRes.tcp = currR.connectEnd - currR.connectStart;
		currRes.ttfb = currR.responseStart - currR.startTime;
		currRes.requestDuration = currR.responseStart - currR.requestStart;
	}
	if(currR.secureConnectionStart){
		currRes.ssl = currR.connectEnd - currR.secureConnectionStart;
	}

	if(currRes.isLocalDomain){
		localResources.push(currRes);
	}else{
		externalResources.push(currRes);
	}

	return currRes;
});

//get counts
var fileExtensionCounts = getItemCount(allRessourcesCalc.map(function(currR, i, arr){
	return currR.initiatorType;
}), "fileType");

var fileExtensionCountLocalExt = getItemCount(allRessourcesCalc.map(function(currR, i, arr){
	return currR.initiatorType + " " + (currR.isLocalDomain ? "(local)" : "(extenal)");
}), "fileType");

var requestsByDomain = getItemCount(allRessourcesCalc.map(function(currR, i, arr){
	return currR.domain;
}), "domain");



// create a chart and table section
var setupChart = function(title, data){
	var chartHolder = newTag("div", {}, "float:left; width:28%; margin: 0 5.3333% 0 0;");
	chartHolder.appendChild(newTag("h1", {text : title}, "font:bold 16px/18px sans-serif; margin:1em 0; color:#666;"));
	chartHolder.appendChild(createPieChart(data, 400));
	chartHolder.appendChild(newTag("p", {text : "total requests: (" + resources.length + ")"}));
	chartHolder.appendChild(createTable(title, data));
	outputContent.appendChild(chartHolder);
};


// init data for charts

var requestsUnit = resources.length / 100;
setupChart("Requests by Domain", requestsByDomain.map(function(domain){
	domain.perc = domain.count / requestsUnit;
	domain.label = domain.domain;
	domain.id = "reqByDomain-" + domain.label.replace(/[^a-zA-Z]/g, "-");
	return domain;
}));

setupChart("Requests by Type (local/external domain)", fileExtensionCountLocalExt.map(function(fileType){
	fileType.perc = fileType.count / requestsUnit;
	fileType.label = fileType.fileType;
	fileType.id = "reqByTypeLocEx-" + fileType.label.replace(/[^a-zA-Z]/g, "-");
	return fileType;
}));

setupChart("Requests by Type", fileExtensionCounts.map(function(fileType){
	fileType.perc = fileType.count / requestsUnit;
	fileType.label = fileType.fileType;
	fileType.id = "reqByType-" + fileType.label.replace(/[^a-zA-Z]/g, "-");
	return fileType;
}));


//marks WIP Start 

var perfTimingCalc = {
	totals : {
		"pageLoadTime" : perfTiming.loadEventEnd - perfTiming.navigationStart,
		"ttfb" : perfTiming.responseStart - perfTiming.navigationStart,
		"domProcessing" : perfTiming.domComplete - perfTiming.domLoading
	}
};
var startTime = perfTiming.navigationStart;
var propBaseName;
for (var perfProp in perfTiming) {
	if(perfTiming.hasOwnProperty(perfProp)){
		if(perfTiming[perfProp]){
			perfTimingCalc[perfProp] = perfTiming[perfProp] - startTime;
			propBaseName = perfProp.match(/(.*)End$/);
			if(propBaseName && perfTiming[propBaseName[1] + "Start"]){
				perfTimingCalc.totals[propBaseName[1]] = perfTiming[perfProp] - perfTiming[propBaseName[1]+"Start"];
			}
		}
	} 
}

var timeBlock = function(name, start, end, colour){
	return {
		name : name,
		start : start,
		end : end,
		total : ((typeof start !== "number" || typeof end !== "number") ? undefined : (end - start)),
		colour : colour
	}
};

perfTimingCalc.blocks = [
	//timeBlock("pageLoadTime", 0, perfTimingCalc.loadEventEnd),
	timeBlock("unload", perfTimingCalc.unloadEventStart, perfTimingCalc.unloadEventEnd, "#909"),
	timeBlock("redirect", perfTimingCalc.redirectStart, perfTimingCalc.redirectEnd, "#009"),
	timeBlock("App cache", perfTimingCalc.fetchStart, perfTimingCalc.domainLookupStart, "#099"),
	timeBlock("DNS", perfTimingCalc.domainLookupStart, perfTimingCalc.domainLookupEnd, "#090"),
	timeBlock("TCP", perfTimingCalc.connectStart, perfTimingCalc.connectEnd, "#990"),
	timeBlock("Request", perfTimingCalc.requestStart, perfTimingCalc.responseStart, "#c90"),
	timeBlock("Response", perfTimingCalc.responseStart, perfTimingCalc.responseEnd, "#6c0"),
	timeBlock("DOM Processing", perfTimingCalc.domLoading, perfTimingCalc.domComplete, "#9cc"),
	timeBlock("domContentLoaded Event", perfTimingCalc.domContentLoadedEventStart, perfTimingCalc.domContentLoadedEventEnd, "#c33"),
	timeBlock("Onload Event", perfTimingCalc.loadEventStart, perfTimingCalc.loadEventEnd, "#cf3")
];

if(perfTimingCalc.secureConnectionStart){
	perfTimingCalc.blocks.push(timeBlock("SSL", perfTimingCalc.connectStart, perfTimingCalc.secureConnectionStart, "#990"));
}

var setupTimeLine = function(){
	var chartHolder = newTag("div", {}, "float:left; width:100%; margin: 25px 0;");
	var timeLineHolder = newElementNs("svg:svg", {
		width : "100%",
		height : perfTimingCalc.blocks.length * 25  + "px",
		fill : "#ccc"
	});
	var timeLineLabelHolder = newElementNs("g", { width : "100%" });
	var timeHolder = newElementNs("g", { width : "100%" });

	var unit = perfTimingCalc.totals.pageLoadTime / 100;

	var createRect = function(width, height, x, y, fill, label){
		var rect = newElementNs("rect", {
			width : (width / unit) + "%",
			height : height + "px",
			x :  (x / unit) + "%",
			y : y + "px",
			fill : fill
		});
		if(label){
			rect.appendChild(newElementNs("title", {
				text : label
			})); // Add tile to wedge path
		}
		return rect;
	};

	for(var i = 0, secs = perfTimingCalc.totals.pageLoadTime / 1000, secPerc = 100 / secs; i <= secs; i++){
		var lineLabel = newTextElementNs(i + "sec", "100%");
		if(i > secs - 0.2){
			lineLabel.setAttribute("x", secPerc * i - 0.5 + "%");
			lineLabel.setAttribute("text-anchor", "end");
		}else{
			lineLabel.setAttribute("x", secPerc * i + 0.5 + "%"); 
		}
		
		var lineEl = newElementNs("line", {
			x1 : secPerc * i + "%",
			y1 : "0px",
			x2 : secPerc * i + "%",
			y2 : "100%"
		}, "stroke:#ccc; stroke-width:1");
		timeHolder.appendChild(lineEl);
		timeHolder.appendChild(lineLabel);
	}
	timeLineHolder.appendChild(timeHolder);


	var barsToShow = perfTimingCalc.blocks.filter(function(block){
		return (typeof block.start == "number" && typeof block.total == "number");
	}).sort(function(a, b){
		return (a.start||0) - (b.start||0);
	});
	barsToShow.unshift(timeBlock("total", 0, perfTimingCalc.totals.pageLoadTime, "#ccc"));

	barsToShow.forEach(function(block, i){
		var blockWidth = block.total||1;
		var y = 25 * i;
		timeLineHolder.appendChild(createRect(blockWidth, 25, block.start||0.001, y, block.colour, block.name + " (" + block.total + "ms)"));

		var blockLabel = newTextElementNs(block.name + " (" + block.total + "ms)", (y + 18) + "px");

		if(((block.total||1) / unit) > 10){
			blockLabel.setAttribute("x", ((block.start||0.001) / unit) + 0.5 + "%");
			blockLabel.setAttribute("width", (blockWidth / unit) + "%");
		}else if(((block.start||0.001) / unit) + (blockWidth / unit) < 80){
			blockLabel.setAttribute("x", ((block.start||0.001) / unit) + (blockWidth / unit) + 0.5 + "%");
		}else {
			blockLabel.setAttribute("x", (block.start||0.001) / unit - 0.5 + "%");
			blockLabel.setAttribute("text-anchor", "end"); 
		}
		timeLineLabelHolder.appendChild(blockLabel);
	});

	timeLineHolder.appendChild(timeLineLabelHolder);
	chartHolder.appendChild(newTag("h1", {
		text : "Navigation Timing"
	}, "font:bold 16px/18px sans-serif; margin:1em 0; color:#666;"));
	chartHolder.appendChild(timeLineHolder);
	outputContent.insertBefore(chartHolder, outputContent.firstChild);
};
setupTimeLine();


//add charts to body
document.body.appendChild(outputHolder);

// also output the data as table in console
// console.log("\n\n\nAll loaded ressources:");
// console.table(allRessourcesCalc);

// console.log("\n\n\nRequests by domain");
// console.table(requestsByDomain, ["domain", "count", "perc"]);

// console.log("\n\n\nFile type count (local / external):");
// console.table(fileExtensionCountLocalExt, ["fileType", "count", "perc"]);

// console.log("\n\n\nFile type count:");
// console.table(fileExtensionCounts, ["fileType", "count", "perc"]);

//timeling from window.performance.timing
console.log("\n\n\nNavigation Timeline:");
console.table(perfTimingCalc.blocks);

console.log("\n\n\nAll times (in ms since navigationStart):");
console.log(perfTimingCalc);

})();