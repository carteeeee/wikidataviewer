const WIKIDATA_ENDPOINT = "https://www.wikidata.org/wiki/Special:EntityData/%s.json";
const LANGUAGE = "en";
const loading = document.getElementById("loading");
const setelem = document.getElementById("settings");
const rielem = document.getElementById("ri");
const depthelem = document.getElementById("depth");
const physelem = document.getElementById("phys");
const goelem = document.getElementById("go");
const tooltip = document.getElementById('tooltip');
const nodes = [];
const edges = [];
const pnc = {};
const inc = {};
let ec = 0;
let en = 0;

async function get_entity(eid, depth, re) {
    console.log(eid);
    const url = WIKIDATA_ENDPOINT.replace("%s", eid);
    ec++;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`non-200 response code from entity id ${eid}`);
        }

        const data = await response.json();
        const ej = Object.values(data.entities)[0];
        const conns = [];

        for (const propertyclaims of Object.values(ej.claims)) {
            loading.innerText = "parsing claims for property "+propertyclaims[0].mainsnak.property+" of element "+eid;
            for (const claim of propertyclaims) {
                if (claim.mainsnak.datatype === "wikibase-item" && claim.mainsnak.snaktype === "value") {
                    console.log(claim);
                    const connid = claim.mainsnak.datavalue.value.id;
                    if (!conns.some(conn => conn[0] === connid)) {
                        if (depth === 0) {
                            conns.push([connid, claim.mainsnak.property]);
                        } else {
                            conns.push([await get_entity(connid, depth - 1, re), claim.mainsnak.property]);
                        }
                    }
                }
            }
        }

        const label = ej.labels[LANGUAGE] ? ej.labels[LANGUAGE].value : eid;

	if (!nodes.some(node => node.id == eid)) {
            if (eid == re) {
	    	nodes.push({id: eid, label: label, x: 0, y: 0});
	    } else {
	        nodes.push({id: eid, label: label});
	    }
	}
        inc[eid] = label;
        return {
            eid: eid,
            label: label,
            conns: conns
        };
    } catch (error) {
        console.error(error);
        throw error;
    }
}

async function get_prop_name(pid) {
    if (pnc[pid]) {
        return pnc[pid];
    } else {
        const url = WIKIDATA_ENDPOINT.replace("%s", pid);
        try {
            const response = await fetch(url);
            const data = await response.json();
            const labels = Object.values(data.entities)[0].labels;
            const name = labels[LANGUAGE] ? labels[LANGUAGE].value : pid;
            pnc[pid] = name;
            return name;
        } catch (error) {
            console.error(error);
            throw error;
        }
    }
}

async function get_item_name(iid) {
    if (inc[iid]) {
        return inc[iid];
    } else {
        const url = WIKIDATA_ENDPOINT.replace("%s", iid);
        try {
            const response = await fetch(url);
            const data = await response.json();
            const labels = Object.values(data.entities)[0].labels;
            const name = labels[LANGUAGE] ? labels[LANGUAGE].value : iid;
            inc[iid] = name;
            return name;
        } catch (error) {
            console.error(error);
            throw error;
        }
    }
}

async function draw_entity(ep) {
    for (const conn of ep.conns) {
        const cn = conn[0].label || await get_item_name(conn[0]);
        const cid = conn[0].eid || conn[0];
	const pn = await get_prop_name(conn[1]);
	if (!nodes.some(node => node.id == cid)) {
            nodes.push({id: cid, label: cn});
	}
	edges.push({from: ep.eid, to: cid, id: en, label: pn, title: conn[1]});
	en++;
	console.log("conn between:", ep.label, "(", ep.eid, ") and", cn, "(", cid, ") with prop", pn, "(", conn[1], ")");
	loading.innerText = "parsing conn between "+ep.label+" ("+ep.eid+") and "+cn+" ("+cid+") with prop "+pn+" ("+conn[1]+")";
	if (conn[0].eid) {
            await draw_entity(conn[0]);
        }
    }
}

async function main() {
    const ri = rielem.value;
    const depth = depthelem.value;
    if (!ri.startsWith("Q")) {
	alert("please input a valid item!");
	return false;
    }
    if (isNaN(depth)) {
        alert("please input a valid depth!");
	return false;
    }
    setelem.classList.add("hidden");
    try {
        const rep = await get_entity(ri, parseInt(depth) - 1, ri);
        await draw_entity(rep);
	console.log("done! number of entities parsed:", ec);
	console.log("number of cached props:", Object.keys(pnc).length);
	loading.innerText="removing duplicates from edges list";
	const newEdges = Array.from(new Set(edges.map(edge=>JSON.stringify(edge)))).map(es=>JSON.parse(es));
	loading.innerText="loading graph";	
        const container = document.getElementById('network');
        const data = {
            nodes: nodes,
            edges: newEdges
        };
        const options = {
	    physics: {enabled: physelem.checked},
	    edges: {arrows: {to: {enabled: true, scaleFactor: 0.5}}},
	    interaction: {hover: true}
	};
        const network = new vis.Network(container, data, options);

	network.on("afterDrawing", _=>{
	    loading.innerText="";
	});

	network.on("hoverNode", e=>{
	    const nid = e.node;
            tooltip.innerHTML = nid;
	    tooltip.style.left = e.pointer.DOM.x + "px";
	    tooltip.style.top = e.pointer.DOM.y + "px";
	    tooltip.style.display = "block";
	});
	
	network.on("blurNode", _=>{
            tooltip.style.display = "none";
	});
	
	network.on("hoverEdge", e=>{
	    const eid = e.edge;
	    const ed = newEdges.find(edge=>(edge.id==eid));
            tooltip.innerHTML = ed.title;
	    tooltip.style.left = e.pointer.DOM.x + "px";
	    tooltip.style.top = e.pointer.DOM.y + "px";
	    tooltip.style.display = "block";
	});
	
	network.on("blurEdge", _=>{
            tooltip.style.display = "none";
	});	
    } catch (error) {
	alert(error);
        console.error(error);
    }
}

goelem.onclick = main;
