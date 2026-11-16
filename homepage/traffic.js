// Decorative city life: pedestrians on the sidewalks, cars in the lanes, and the odd helicopter.
// No storage and no pointer events. Movers follow whatever road cells they are given,
// so layout changes need no changes here.
import { project } from "./layout.js";

const ASSETS = "../assets/Isometric City";

// Grid step for each sprite direction. Screen: +x goes down-right (SE), +y goes down-left (SW).
const DIRECTIONS = { SE: [1, 0], NW: [-1, 0], SW: [0, 1], NE: [0, -1] };

// Measured on the road tiles, in cells from the centre of a tile.
const SIDEWALK = 0.425; // middle of the sidewalk strip along each road edge
const CROSSWALK = 0.7; // stripes of a crosswalk tile next to a junction
const LIGHT_SIDE = 0.46; // traffic lights stand on the outer half of the sidewalk
const LIGHTS_SHARE = 0.3; // share of crosswalks that get traffic lights
const LIGHT_ALONG = 0.22; // just behind the crosswalk stripes (0.25–0.35 towards the junction)

const PEDESTRIAN = {
    speed: 0.3, // cells per second
    frameRate: 3, // walk frames per second, matched to the speed so feet do not slide
    pauseChance: 0.08, // chance to stop for a while after each cell
    pause: [1, 3], // seconds
};
const CAR = {
    speed: 1.6,
    lane: 0.14, // right-hand lane, distance from the road centre line
    crossingStopChance: 0.5, // chance to wait before the crosswalk ahead of a junction
    crossingStop: [1, 2.5],
    life: [25, 50],
    gap: 0.7, // keep this far (cells) behind the car ahead
    width: 0.22, // cars closer sideways than this share the lane (the opposite lane is 0.28 away)
    maxWait: 5, // seconds; after this a stuck car goes anyway, so no jam lasts forever
};
const HELICOPTER = { speed: 2.2, altitude: 90, chancePerSecond: 1 / 90 };

// Bigger vehicles show up less often (weights are relative). The "box" sprites are left out:
// they are trailers without a cab, so their front looks hollow.
const VEHICLES = [
    ...["blue", "red", "white"].map((color) => [`sedan_${color}`, 6]),
    ...["black", "orange", "red"].map((color) => [`pickup_${color}`, 4]),
    ...["black", "purple", "white"].map((color) => [`van_${color}`, 4]),
    ...["green", "red", "yellow"].map((color) => [`truck_${color}`, 2]),
    ["police", 2],
    ["garbage", 1.5],
    ["bus_school", 1],
    ["firetruck", 0.7],
    ["swat", 0.5],
];

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const pick = (items) => items[Math.floor(Math.random() * items.length)];
const between = ([min, max]) => min + Math.random() * (max - min);
const key = (x, y) => `${x},${y}`;
// Stable pseudo-random coin per grid cell, so decorations do not jump between renders.
const hasLights = (x, y) => {
    const value = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return value - Math.floor(value) < LIGHTS_SHARE;
};
const same = (a, b) => a && b && a[0] === b[0] && a[1] === b[1];
const reverse = (step) => [-step[0], -step[1]];
// Right-hand side of a direction of travel.
const rightOf = (step) => [-step[1], step[0]];

function weightedPick(entries) {
    let roll = Math.random() * entries.reduce((sum, [, weight]) => sum + weight, 0);
    for (const [value, weight] of entries) {
        roll -= weight;
        if (roll < 0) return value;
    }
    return entries[0][0];
}

function directionOf(dx, dy) {
    if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "SE" : "NW";
    return dy >= 0 ? "SW" : "NE";
}

function vehicleSrc(name, direction) {
    // The garbage truck is the only asset with a "_normal" suffix.
    return `${ASSETS}/Vehicles/veh_${name}_${direction}${name === "garbage" ? "_normal" : ""}.png`;
}

// Start transparent and let the CSS opacity transition fade the sprite in.
function fadeIn(image) {
    image.style.opacity = "0";
    requestAnimationFrame(() => requestAnimationFrame(() => image.style.removeProperty("opacity")));
}

// Where a vehicle's ground footprint centre sits inside its sprite, measured once per image.
// An isometric footprint is half as tall as it is wide, so its centre is a quarter of the body's
// width above the body's bottom. Only the solid body counts: the sprites also carry a soft drop
// shadow to the lower right, which would otherwise push the anchor up and draw the car too low.
const anchors = new Map();
function measureAnchor(image) {
    const { naturalWidth: w, naturalHeight: h } = image;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, w, h);
    let [left, right, bottom] = [w, -1, -1];
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            if (data[(y * w + x) * 4 + 3] < 200) continue; // transparent or shadow
            left = Math.min(left, x);
            right = Math.max(right, x);
            bottom = Math.max(bottom, y);
        }
    }
    if (right < 0) return { x: w / 2, y: h - w / 4 };
    const width = right - left + 1;
    return { x: left + width / 2, y: bottom + 1 - width / 4 };
}

function anchorVehicle(image) {
    image.addEventListener("load", () => {
        const src = image.getAttribute("src");
        if (!anchors.has(src)) anchors.set(src, measureAnchor(image));
        const { x, y } = anchors.get(src);
        image.style.transform = `translate(${-x}px, ${-y}px)`;
    });
}

export function createTraffic(container) {
    let roads = new Map();
    let pedestrians = [];
    let cars = [];
    let helicopter = null;
    let lights = [];
    let lastTime = 0;

    const isRoad = (x, y) => roads.has(key(x, y));
    const neighbours = (cell) =>
        Object.values(DIRECTIONS)
            .map(([dx, dy]) => roads.get(key(cell.x + dx, cell.y + dy)))
            .filter(Boolean);
    const isJunction = (cell) => neighbours(cell).length >= 3;

    // Pedestrian route through `cell`: from sidewalk corner to sidewalk corner on the walker's side.
    // Passing the mouth of a side street, the walker steps out onto its crosswalk.
    function walkPoints(walker, cell, inStep, outStep) {
        const forward = inStep;
        const side = rightOf(inStep).map((value) => value * walker.side);
        const corner = (a, b) => ({
            x: cell.x + 0.5 + (a * forward[0] + b * side[0]) * SIDEWALK,
            y: cell.y + 0.5 + (a * forward[1] + b * side[1]) * SIDEWALK,
            a,
            b,
        });
        let ring;
        if (same(outStep, forward)) ring = [corner(-1, 1), corner(1, 1)];
        else if (same(outStep, reverse(side))) ring = [corner(-1, 1), corner(1, 1), corner(1, -1)];
        else ring = [corner(-1, 1)]; // turning into our own side, or back at a dead end
        if (same(outStep, reverse(forward))) walker.side = -walker.side; // stay on the same sidewalk

        const points = [ring[0]];
        for (let i = 1; i < ring.length; i++) {
            const [from, to] = [ring[i - 1], ring[i]];
            // The edge between two corners lies in the direction both share.
            const edge = from.b === to.b ? side.map((v) => v * from.b) : forward.map((v) => v * from.a);
            if (isRoad(cell.x + edge[0], cell.y + edge[1])) {
                const out = CROSSWALK - SIDEWALK;
                points.push(
                    { x: from.x + edge[0] * out, y: from.y + edge[1] * out },
                    { x: to.x + edge[0] * out, y: to.y + edge[1] * out },
                );
            }
            points.push(to);
        }
        if (Math.random() < PEDESTRIAN.pauseChance) points.at(-1).stop = between(PEDESTRIAN.pause);
        return points;
    }

    // Car route through `cell`: one point in the right-hand lane, shifted for turns.
    function drivePoints(cell, inStep, outStep, next) {
        const lanePoint = (back = 0) => {
            let x = cell.x + 0.5 - inStep[0] * back;
            let y = cell.y + 0.5 - inStep[1] * back;
            for (const step of same(outStep, inStep) || same(outStep, reverse(inStep)) ? [inStep] : [inStep, outStep]) {
                x += rightOf(step)[0] * CAR.lane;
                y += rightOf(step)[1] * CAR.lane;
            }
            return { x, y };
        };
        const beforeCrossing = same(outStep, inStep) && isJunction(next) && !isJunction(cell);
        if (beforeCrossing && Math.random() < CAR.crossingStopChance) {
            // Wait a little short of the stripes, then go on.
            return [{ ...lanePoint(0.15), stop: between(CAR.crossingStop) }, lanePoint()];
        }
        return [lanePoint()];
    }

    // Pick the next cell and queue the route through the current one.
    function plan(mover) {
        const options = neighbours(mover.cell);
        const ahead = options.filter((cell) => cell !== mover.previous);
        const next = pick(ahead.length ? ahead : options);
        if (!next) return false;
        const outStep = [next.x - mover.cell.x, next.y - mover.cell.y];
        mover.path.push(
            ...(mover.kind === PEDESTRIAN
                ? walkPoints(mover, mover.cell, mover.step, outStep)
                : drivePoints(mover.cell, mover.step, outStep, next)),
        );
        mover.previous = mover.cell;
        mover.cell = next;
        mover.step = outStep;
        return true;
    }

    // The nearest other car in front of `car`, in its lane and closer than CAR.gap, if any.
    function carAhead(car) {
        const target = car.path[0];
        let [ux, uy] = DIRECTIONS[car.direction];
        if (target) {
            const length = Math.hypot(target.x - car.position.x, target.y - car.position.y);
            if (length > 1e-6) [ux, uy] = [(target.x - car.position.x) / length, (target.y - car.position.y) / length];
        }
        let nearest = null;
        let nearestAlong = CAR.gap;
        for (const other of cars) {
            if (other === car) continue;
            const dx = other.position.x - car.position.x;
            const dy = other.position.y - car.position.y;
            const along = dx * ux + dy * uy;
            const sideways = Math.abs(dx * uy - dy * ux);
            if (along > 0 && along < nearestAlong && sideways < CAR.width) {
                nearest = other;
                nearestAlong = along;
            }
        }
        return nearest;
    }

    // Moves along the queued route. Returns true while actually moving.
    function advance(mover, seconds) {
        if (mover.pause > 0) {
            mover.pause -= seconds;
            return false;
        }
        let budget = mover.kind.speed * seconds;
        let moved = false;
        while (budget > 0) {
            if (!mover.path.length && !plan(mover)) break;
            const target = mover.path[0];
            const dx = target.x - mover.position.x;
            const dy = target.y - mover.position.y;
            const distance = Math.hypot(dx, dy);
            if (distance > 1e-6) mover.direction = directionOf(dx, dy);
            if (distance <= budget) {
                mover.position = { x: target.x, y: target.y };
                mover.path.shift();
                budget -= distance;
                moved ||= distance > 0;
                if (target.stop) {
                    mover.pause = target.stop;
                    break;
                }
            } else {
                mover.position = {
                    x: mover.position.x + (dx / distance) * budget,
                    y: mover.position.y + (dy / distance) * budget,
                };
                budget = 0;
                moved = true;
            }
        }
        return moved;
    }

    function place(mover, src, z) {
        const { left, top } = project(mover.position.x, mover.position.y);
        if (mover.image.getAttribute("src") !== src) mover.image.src = src;
        mover.image.style.left = `${left}px`;
        mover.image.style.top = `${top - (mover.altitude ?? 0)}px`;
        mover.image.style.zIndex = String(z);
    }

    // Depth against buildings: a building in cell (cx, cy) has z-index 1000 + cx + cy and its footprint
    // centre at x + y = cx + cy + 1. Anything further forward than that centre gets at least the same
    // z-index, and #traffic comes after #buildings in the page, so equal values draw the traffic on top.
    const depth = ({ x, y }) => 1000 + Math.floor(x + y - 1);

    // Equal z-index values fall back to page order, so keep the traffic layer's children sorted
    // front-to-back by ground position (x + y). Only touches the DOM when the order changes.
    function sortByDepth() {
        const ordered = [...lights, ...pedestrians, ...cars]
            .sort((a, b) => a.position.x + a.position.y - (b.position.x + b.position.y))
            .map((item) => item.image);
        const current = [...container.children].filter((element) => ordered.includes(element));
        if (current.some((element, index) => element !== ordered[index])) {
            for (const element of ordered) container.append(element);
        }
    }

    function spawnOnRoad(kind, className, extra, avoid = []) {
        // Start away from the given movers when possible, so new arrivals do not appear on top of them.
        const cells = [...roads.values()];
        const clear = cells.filter((cell) =>
            avoid.every((other) => Math.hypot(cell.x + 0.5 - other.position.x, cell.y + 0.5 - other.position.y) > 2),
        );
        const cell = pick(clear.length ? clear : cells);
        const step = pick(Object.values(DIRECTIONS));
        const image = document.createElement("img");
        image.className = className;
        image.alt = "";
        fadeIn(image);
        const mover = { kind, image, cell, previous: null, step, side: 1, path: [], pause: 0, frame: 0, ...extra };
        const lane = kind === PEDESTRIAN ? SIDEWALK : CAR.lane;
        mover.position = {
            x: cell.x + 0.5 - step[0] * (kind === PEDESTRIAN ? SIDEWALK : 0) + rightOf(step)[0] * lane,
            y: cell.y + 0.5 - step[1] * (kind === PEDESTRIAN ? SIDEWALK : 0) + rightOf(step)[1] * lane,
        };
        mover.direction = directionOf(...step);
        container.append(image);
        return mover;
    }

    function drawPedestrian(person, walking) {
        const frame = String(Math.floor(person.frame) + 1).padStart(2, "0");
        const pose = walking ? `walk_${person.direction}_f${frame}` : `idle_${person.direction}_f01`;
        place(person, `${ASSETS}/Characters/char_${person.character}_${pose}.png`, depth(person.position));
    }

    function spawnCar() {
        const car = spawnOnRoad(
            CAR,
            "traffic-car",
            { name: weightedPick(VEHICLES), life: between(CAR.life), waited: 0 },
            cars,
        );
        anchorVehicle(car.image);
        place(car, vehicleSrc(car.name, car.direction), depth(car.position));
        return car;
    }

    // Fade out, then remove; a fresh (randomly chosen) vehicle takes its place.
    function retire(mover) {
        mover.image.classList.add("leaving");
        setTimeout(() => mover.image.remove(), 600);
    }

    function spawnHelicopter() {
        const cells = [...roads.values()];
        const xs = cells.map((cell) => cell.x);
        const ys = cells.map((cell) => cell.y);
        const [minX, maxX] = [Math.min(...xs) - 3, Math.max(...xs) + 4];
        const [minY, maxY] = [Math.min(...ys) - 3, Math.max(...ys) + 4];
        const direction = pick(Object.keys(DIRECTIONS));
        const [dx, dy] = DIRECTIONS[direction];
        // Fly straight across the whole city along one grid axis.
        const lineX = minX + 3 + Math.random() * (maxX - minX - 6);
        const lineY = minY + 3 + Math.random() * (maxY - minY - 6);
        const from = dx ? { x: dx > 0 ? minX : maxX, y: lineY } : { x: lineX, y: dy > 0 ? minY : maxY };
        const to = dx ? { x: dx > 0 ? maxX : minX, y: lineY } : { x: lineX, y: dy > 0 ? maxY : minY };
        const image = document.createElement("img");
        image.className = "traffic-helicopter";
        image.alt = "";
        fadeIn(image);
        anchorVehicle(image);
        container.append(image);
        return {
            image,
            color: pick(["red", "white"]),
            direction,
            from,
            to,
            position: { ...from },
            progress: 0,
            frame: 0,
            altitude: HELICOPTER.altitude,
        };
    }

    function tick(time) {
        const seconds = Math.min((time - lastTime) / 1000, 0.1);
        lastTime = time;
        const still = reducedMotion.matches;

        for (const person of pedestrians) {
            const walking = !still && advance(person, seconds);
            if (walking) person.frame = (person.frame + seconds * PEDESTRIAN.frameRate) % 4;
            drawPedestrian(person, walking);
        }

        for (const car of [...cars]) {
            if (!still) {
                const ahead = carAhead(car);
                // Two cars blocking each other (e.g. meeting in a junction): the earlier one goes first.
                const deadlock = ahead && carAhead(ahead) === car && cars.indexOf(car) < cars.indexOf(ahead);
                if (ahead && !deadlock && car.waited < CAR.maxWait) {
                    car.waited += seconds;
                } else {
                    car.waited = 0;
                    advance(car, seconds);
                }
                car.life -= seconds;
            }
            place(car, vehicleSrc(car.name, car.direction), depth(car.position));
            if (car.life <= 0 && roads.size) {
                retire(car);
                cars[cars.indexOf(car)] = spawnCar();
            }
        }

        if (!helicopter && !still && roads.size && Math.random() < HELICOPTER.chancePerSecond * seconds) {
            helicopter = spawnHelicopter();
        }
        if (helicopter) {
            const { from, to } = helicopter;
            const distance = Math.hypot(to.x - from.x, to.y - from.y);
            if (!still) helicopter.progress += (HELICOPTER.speed * seconds) / distance;
            helicopter.frame = (helicopter.frame + seconds * 12) % 2;
            helicopter.position = {
                x: from.x + (to.x - from.x) * helicopter.progress,
                y: from.y + (to.y - from.y) * helicopter.progress,
            };
            const frame = Math.floor(helicopter.frame) + 1;
            // Flies above every building but under the focused building (1999) and name labels (2000).
            place(
                helicopter,
                `${ASSETS}/Vehicles/veh_helicopter_${helicopter.color}_${helicopter.direction}_f${frame}.png`,
                1900,
            );
            if (helicopter.progress >= 1) {
                helicopter.image.remove();
                helicopter = null;
            }
        }

        sortByDepth();
        requestAnimationFrame(tick);
    }

    // Movers whose road disappeared start over somewhere on the new roads.
    function keepOnRoads(movers, wanted) {
        return movers.filter((mover, index) => {
            const cell = roads.get(key(mover.cell.x, mover.cell.y));
            if (!cell || index >= wanted) {
                mover.image.remove();
                return false;
            }
            mover.cell = cell;
            mover.previous = mover.previous ? (roads.get(key(mover.previous.x, mover.previous.y)) ?? null) : null;
            return true;
        });
    }

    // About LIGHTS_SHARE of the crosswalks get a pair of traffic lights, one on each side of the road.
    // Which ones is fixed by position, so lights stay put across renders. The crosswalks are the
    // "pelican" tiles chosen by planRoads, named after the end that touches the junction.
    function placeLights(roadCells) {
        for (const light of lights) light.image.remove();
        lights = [];
        for (const { x, y, tile } of roadCells) {
            const end = /pelican_(NW|NE|SE|SW)/.exec(tile ?? "")?.[1];
            if (!end || !hasLights(x, y)) continue;
            const toward = DIRECTIONS[end];
            const across = rightOf(toward);
            for (const side of [1, -1]) {
                const facing = across.map((value) => -value * side);
                // The sprites differ only in which way the lights face: a → +y (SW), b → +x (SE), c → away.
                const variant = facing[1] > 0 ? "a" : facing[0] > 0 ? "b" : "c";
                const position = {
                    x: x + 0.5 + toward[0] * LIGHT_ALONG + across[0] * side * LIGHT_SIDE,
                    y: y + 0.5 + toward[1] * LIGHT_ALONG + across[1] * side * LIGHT_SIDE,
                };
                const { left, top } = project(position.x, position.y);
                const image = document.createElement("img");
                image.className = "traffic-light";
                image.alt = "";
                image.src = `${ASSETS}/Props/prop_trafficlight_${variant}.png`;
                image.style.left = `${left}px`;
                image.style.top = `${top}px`;
                image.style.zIndex = String(depth(position));
                container.append(image);
                lights.push({ image, position });
            }
        }
    }

    // Called after every city render with the current road cells ({ x, y }).
    function update(roadCells) {
        roads = new Map(roadCells.map(({ x, y }) => [key(x, y), { x, y }]));
        placeLights(roadCells);
        const wanted = roads.size === 0 ? 0 : roads.size < 24 ? 1 : 2;

        pedestrians = keepOnRoads(pedestrians, wanted);
        const unused = ["a", "b", "c"].filter((character) => !pedestrians.some((p) => p.character === character));
        while (pedestrians.length < wanted) {
            const character = unused.splice(Math.floor(Math.random() * unused.length), 1)[0];
            const person = spawnOnRoad(PEDESTRIAN, "traffic-pedestrian", { character });
            drawPedestrian(person, false);
            pedestrians.push(person);
        }

        cars = keepOnRoads(cars, wanted);
        while (cars.length < wanted) cars.push(spawnCar());

        if (helicopter && !roads.size) {
            helicopter.image.remove();
            helicopter = null;
        }
    }

    requestAnimationFrame((time) => {
        lastTime = time;
        requestAnimationFrame(tick);
    });
    return { update };
}
