const apiKey = ""; // Environment injects this
const canvas = document.getElementById('graphCanvas');
const ctx = canvas.getContext('2d');

let currentGraphData = { nodes: {}, edges: [] };

// --- 1. Graph Logic & Generators ---

// Helper: Euclidean distance
function dist(n1, n2) {
    return Math.round(Math.sqrt(Math.pow(n1.x - n2.x, 2) + Math.pow(n1.y - n2.y, 2)) / 10);
}

// Local Fallback Generator (Robust & Instant)
function generateLocalGraph(difficulty) {
    const width = 800;
    const height = 500;
    const nodeCount = difficulty === 'hard' ? 9 : 6;
    const connectionProb = difficulty === 'hard' ? 2.5 : 2; // Max connections per node approx

    let nodes = {};
    let labels = ['S', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'Z'];

    // 1. Create Nodes with safe spacing
    let attempts = 0;
    const placed = [];

    // Always place S (Start) and Z (Goal) first at opposite ends
    nodes['S'] = { x: 100, y: height / 2, h: 0, color: '#dbeafe' };
    nodes['Z'] = { x: width - 100, y: height / 2, h: 0, color: '#dcfce7' };
    placed.push(nodes['S'], nodes['Z']);

    // Place intermediate nodes
    for (let i = 1; i < nodeCount - 1; i++) {
        let label = labels[i];
        let safe = false;
        while (!safe && attempts < 2000) {
            attempts++;
            let x = 150 + Math.random() * (width - 300);
            let y = 80 + Math.random() * (height - 160); // Keep away from extreme edges

            // Check collision - Increased radius to 110 for better spacing
            let collision = placed.some(n => Math.sqrt(Math.pow(n.x - x, 2) + Math.pow(n.y - y, 2)) < 110);

            if (!collision) {
                nodes[label] = { x, y, h: 0, color: '#f3f4f6' };
                placed.push(nodes[label]);
                safe = true;
            }
        }
    }

    // 2. Calculate Admissible Heuristics (Euclidean to Z)
    // We multiply by a factor slightly < 1 to ensure admissibility, or exact distance
    for (let key in nodes) {
        const d = Math.sqrt(Math.pow(nodes[key].x - nodes['Z'].x, 2) + Math.pow(nodes[key].y - nodes['Z'].y, 2));
        // Scale down to simplified integer units (pixels / 40 approx)
        nodes[key].h = Math.floor(d / 40);
    }

    // Helper: Distance from point p to line segment v-w
    function distToSegment(p, v, w) {
        const l2 = Math.pow(v.x - w.x, 2) + Math.pow(v.y - w.y, 2);
        if (l2 === 0) return Math.sqrt(Math.pow(p.x - v.x, 2) + Math.pow(p.y - v.y, 2));
        let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        const projX = v.x + t * (w.x - v.x);
        const projY = v.y + t * (w.y - v.y);
        return Math.sqrt(Math.pow(p.x - projX, 2) + Math.pow(p.y - projY, 2));
    }

    // 3. Create Edges
    let edges = [];
    let edgeKeys = new Set();

    // Ensure connectivity: Each node (except Z) tries to connect to 1-2 forward-ish nodes
    const keys = Object.keys(nodes).sort((a, b) => nodes[a].x - nodes[b].x);

    for (let i = 0; i < keys.length; i++) {
        let u = keys[i];
        if (u === 'Z') continue;

        // Find nearest neighbors
        let neighbors = keys.filter(v => v !== u).sort((a, b) => {
            let d1 = dist(nodes[u], nodes[a]);
            let d2 = dist(nodes[u], nodes[b]);
            return d1 - d2;
        });

        // Connect to 1-3 close nodes
        let connections = Math.floor(Math.random() * 2) + 1;
        if (difficulty === 'hard') connections += 1;

        for (let j = 0; j < Math.min(connections + 2, neighbors.length); j++) { // Check a few more neighbors
            let v = neighbors[j];

            // Stop if we have enough connections
            let currentConnections = edges.filter(e => e.from === u || e.to === u).length;
            if (currentConnections >= connections) break;

            // Prevent dupes
            let edgeKey = [u, v].sort().join('-');
            if (edgeKeys.has(edgeKey)) continue;

            // CHECK: Does this edge cross too close to another node?
            let intersection = false;
            for (let k in nodes) {
                if (k === u || k === v) continue;
                if (distToSegment(nodes[k], nodes[u], nodes[v]) < 45) { // 45px clearance
                    intersection = true;
                    break;
                }
            }
            if (intersection) continue;

            // Weight = Distance + Random variation (but >= Distance to enable A*)
            // For A* practice, we often make weight slightly higher than pure euclidean
            let d = Math.floor(Math.sqrt(Math.pow(nodes[u].x - nodes[v].x, 2) + Math.pow(nodes[u].y - nodes[v].y, 2)) / 40);
            let weight = Math.max(1, d + Math.floor(Math.random() * 3));

            edges.push({ from: u, to: v, weight: weight });
            edgeKeys.add(edgeKey);
        }
    }

    // Ensure S has edges
    if (!edges.some(e => e.from === 'S' || e.to === 'S')) {
        let closest = keys[1]; // First after S
        let d = Math.floor(Math.sqrt(Math.pow(nodes['S'].x - nodes[closest].x, 2) + Math.pow(nodes['S'].y - nodes[closest].y, 2)) / 40);
        edges.push({ from: 'S', to: closest, weight: d });
    }

    // 4. Ensure Full Connectivity (Connect Components)
    // Repeatedly connect the main component (starting at S) to the closest disconnected node
    while (true) {
        // BFS to find all reachable nodes from S
        let reachable = new Set(['S']);
        let queue = ['S'];
        while (queue.length > 0) {
            let u = queue.shift();
            edges.forEach(e => {
                if (e.from === u && !reachable.has(e.to)) {
                    reachable.add(e.to);
                    queue.push(e.to);
                }
                if (e.to === u && !reachable.has(e.from)) {
                    reachable.add(e.from);
                    queue.push(e.from);
                }
            });
        }

        // If all nodes are reachable, we are done
        const allNodes = Object.keys(nodes);
        if (reachable.size === allNodes.length) break;

        // Find unreachable nodes
        let unreachable = allNodes.filter(n => !reachable.has(n));

        // Find closest pair (u, v) where u is reachable, v is unreachable
        let bestEdge = null;
        let minDist = Infinity;

        reachable.forEach(u => {
            unreachable.forEach(v => {
                let d = Math.sqrt(Math.pow(nodes[u].x - nodes[v].x, 2) + Math.pow(nodes[u].y - nodes[v].y, 2));
                if (d < minDist) {
                    minDist = d;
                    bestEdge = { u, v };
                }
            });
        });

        // Connect them
        if (bestEdge) {
            let u = bestEdge.u;
            let v = bestEdge.v;
            let d = Math.floor(minDist / 40);
            let weight = Math.max(1, d + Math.floor(Math.random() * 2)); // Minimal random variation

            // Ensure weight >= heuristic difference for consistency (though not strictly required for connectivity, good for A*)
            // But here we just want to connect.

            edges.push({ from: u, to: v, weight: weight });
        } else {
            break; // Should not happen if nodes exist
        }
    }

    return { nodes, edges };
}

// Gemini Generator
async function generateGeminiGraph(difficulty) {
    const prompt = `
        Generate a JSON object for a graph problem to practice A* algorithm.
        Difficulty: ${difficulty}.
        The output must be strictly JSON with this structure:
        {
          "nodes": { "Label": { "x": int (50-750), "y": int (50-450), "h": int (heuristic to Goal) } },
          "edges": [ { "from": "Label", "to": "Label", "weight": int } ]
        }
        Required nodes: "S" (Start, x~100, y~250) and "Z" (Goal, x~700, y~250).
        Ensure "h" is admissible (h <= real cost).
        Ensure path exists.
        Do not include markdown code blocks.
    `;

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        }
    );

    if (!response.ok) throw new Error('API Error');

    const data = await response.json();
    const text = data.candidates[0].content.parts[0].text;
    // Clean markdown if present
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const graph = JSON.parse(jsonStr);

    // Post-process colors
    for (let k in graph.nodes) {
        if (k === 'S') graph.nodes[k].color = '#dbeafe';
        else if (k === 'Z') graph.nodes[k].color = '#dcfce7';
        else graph.nodes[k].color = '#f3f4f6';
    }
    return graph;
}

// Main Control
async function generateGraph() {
    const btn = document.getElementById('genBtn');
    const btnIcon = document.getElementById('btnIcon');
    const btnText = document.getElementById('btnText');
    const diff = document.getElementById('difficulty').value;

    // Loading State
    btn.disabled = true;
    btnIcon.className = 'loader';
    btnIcon.textContent = '';
    btnText.textContent = 'Generating...';

    try {
        if (apiKey && apiKey.length > 5) {
            // Use Gemini if Key exists
            currentGraphData = await generateGeminiGraph(diff);
        } else {
            // Use Local Fallback
            console.log("Using Local Generator");
            // Simulate small delay for UX
            await new Promise(r => setTimeout(r, 500));
            currentGraphData = generateLocalGraph(diff);
        }
        draw();
        updateTable();
    } catch (e) {
        console.error(e);
        // Fallback on error
        currentGraphData = generateLocalGraph(diff);
        draw();
        updateTable();
    } finally {
        // Reset Button
        btn.disabled = false;
        btnIcon.className = '';
        btnIcon.textContent = '✨';
        btnText.textContent = 'Generate New Map';
    }
}

// --- 2. Drawing Logic ---

function draw() {
    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const { nodes, edges } = currentGraphData;

    // Draw Edges
    edges.forEach(edge => {
        const n1 = nodes[edge.from];
        const n2 = nodes[edge.to];
        if (n1 && n2) drawLine(n1.x, n1.y, n2.x, n2.y, edge.weight);
    });

    // Draw Nodes
    for (const [id, data] of Object.entries(nodes)) {
        drawNode(id, data.x, data.y, data.h, data.color);
    }
}

function drawLine(x1, y1, x2, y2, weight) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Weight Badge
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;

    ctx.beginPath();
    ctx.arc(midX, midY, 12, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#000000';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(weight, midX, midY);
}

function drawNode(id, x, y, h, color) {
    // Circle
    ctx.beginPath();
    ctx.arc(x, y, 25, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.stroke();

    // ID
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(id, x, y);

    // Heuristic Box
    const hBoxX = x + 15;
    const hBoxY = y - 35;
    ctx.fillStyle = '#fee2e2';
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1;
    ctx.fillRect(hBoxX, hBoxY, 45, 24);
    ctx.strokeRect(hBoxX, hBoxY, 45, 24);

    ctx.fillStyle = '#b91c1c';
    ctx.font = '12px sans-serif';
    ctx.fillText(`h = ${h}`, hBoxX + 22.5, hBoxY + 12);
}

// --- 3. Table & Utils ---

function updateTable(solution = null) {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';

    // Sort nodes: S first, Z last, others alphabetical
    const keys = Object.keys(currentGraphData.nodes).sort((a, b) => {
        if (a === 'S') return -1;
        if (b === 'S') return 1;
        if (a === 'Z') return 1;
        if (b === 'Z') return -1;
        return a.localeCompare(b);
    });

    keys.forEach(key => {
        const node = currentGraphData.nodes[key];
        let g = key === 'S' ? '0' : '∞';
        let f = key === 'S' ? node.h : '∞';
        let prev = key === 'S' ? '-' : '';
        let visited = 'No';

        if (solution && solution[key]) {
            g = solution[key].g === Infinity ? '∞' : solution[key].g;
            f = solution[key].f === Infinity ? '∞' : solution[key].f;
            prev = solution[key].parent || '-';
            visited = solution[key].visited ? 'Yes' : 'No';
        }

        let label = key;
        if (key === 'S') label += ' <span class="text-xs text-blue-600 font-bold">(Start)</span>';
        if (key === 'Z') label += ' <span class="text-xs text-green-600 font-bold">(Goal)</span>';

        const row = `
            <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${label}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${g}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-bold text-red-600">${node.h}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${f}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${prev}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${visited}</td>
            </tr>
        `;
        tbody.innerHTML += row;
    });
}

function copyCanvas() {
    canvas.toBlob(blob => {
        try {
            navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
            ]).then(showToast).catch(e => {
                // Fallback for iframe restrictions: Download
                const link = document.createElement('a');
                link.download = 'astar-graph.png';
                link.href = canvas.toDataURL();
                link.click();
            });
        } catch (e) {
            // Fallback for iframe restrictions
            const link = document.createElement('a');
            link.download = 'astar-graph.png';
            link.href = canvas.toDataURL();
            link.click();
        }
    });
}

function copyTableMarkdown() {
    const keys = Object.keys(currentGraphData.nodes).sort((a, b) => {
        if (a === 'S') return -1;
        if (b === 'S') return 1;
        if (a === 'Z') return 1;
        if (b === 'Z') return -1;
        return a.localeCompare(b);
    });

    let md = '| Node | Dist from Start (g) | Heuristic (h) | Total (f = g + h) | Previous Node | Visited? |\\n';
    md += '| :--- | :--- | :--- | :--- | :--- | :--- |\\n';

    keys.forEach(k => {
        const h = currentGraphData.nodes[k].h;
        const g = k === 'S' ? '0' : '∞';
        const f = k === 'S' ? h : '∞';
        const prev = k === 'S' ? '-' : ' ';
        md += `| ${k} | ${g} | ${h} | ${f} | ${prev} | No |\\n`;
    });

    navigator.clipboard.writeText(md).then(showToast).catch(e => alert("Failed to copy"));
}

function showToast() {
    const toast = document.getElementById('toast');
    toast.classList.remove('opacity-0', 'translate-y-20');
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-20');
    }, 2000);
}

// --- 4. A* Solver ---

function solveAStar() {
    const nodes = currentGraphData.nodes;
    const edges = currentGraphData.edges;

    // Initialize state
    let state = {};
    for (let k in nodes) {
        state[k] = { g: Infinity, f: Infinity, parent: null, visited: false };
    }
    state['S'].g = 0;
    state['S'].f = nodes['S'].h;

    let openSet = ['S'];
    let closedSet = new Set();

    while (openSet.length > 0) {
        // Get node with lowest f
        openSet.sort((a, b) => state[a].f - state[b].f);
        let current = openSet.shift();

        state[current].visited = true;
        closedSet.add(current);

        if (current === 'Z') break; // Reached goal

        // Get neighbors
        let neighbors = edges.filter(e => e.from === current).map(e => ({ id: e.to, weight: e.weight }))
            .concat(edges.filter(e => e.to === current).map(e => ({ id: e.from, weight: e.weight })));

        for (let neighbor of neighbors) {
            if (closedSet.has(neighbor.id)) continue;

            let tentativeG = state[current].g + neighbor.weight;

            if (tentativeG < state[neighbor.id].g) {
                state[neighbor.id].parent = current;
                state[neighbor.id].g = tentativeG;
                state[neighbor.id].f = tentativeG + nodes[neighbor.id].h;

                if (!openSet.includes(neighbor.id)) {
                    openSet.push(neighbor.id);
                }
            }
        }
    }
    return state;
}

function showAnswer() {
    if (confirm("Are you sure you want to see the answer? This is for checking your work.")) {
        const solution = solveAStar();
        updateTable(solution);
    }
}

// Initialize
generateLocalGraph('easy'); // Prep initial data
currentGraphData = generateLocalGraph('easy');
draw();
updateTable();
