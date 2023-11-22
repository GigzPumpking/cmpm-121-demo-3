import "leaflet/dist/leaflet.css";
import "./style.css";
import leaflet, { Polyline } from "leaflet";
import luck from "./luck";
import "./leafletWorkaround";
import { Board, Cell } from "./board";

const MERRILL_CLASSROOM = leaflet.latLng({
  lat: 36.9995,
  lng: -122.0533,
});

const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 8;
const PIT_SPAWN_PROBABILITY = 0.1;

const world: Board = new Board(TILE_DEGREES, NEIGHBORHOOD_SIZE);
let locations: leaflet.LatLng[] = [];
let line: Polyline;
const lines: Polyline[] = [];

const mapContainer = document.querySelector<HTMLElement>("#map")!;

const map = leaflet.map(mapContainer, {
  center: MERRILL_CLASSROOM,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      "&copy; <a href=\"http://www.openstreetmap.org/copyright\">OpenStreetMap</a>",
  })
  .addTo(map);

const playerMarker: leaflet.Marker = leaflet.marker(MERRILL_CLASSROOM);
playerMarker.bindTooltip("That's you!");
playerMarker.addTo(map);

let isTracking = false;

const sensorButton = document.querySelector("#sensor")!;
sensorButton.addEventListener("click", () => {
  isTracking = !isTracking;
  if (isTracking) {
    sensorButton.classList.add("active");
  } else {
    sensorButton.classList.remove("active");
  }
});

const resetButton = document.querySelector("#reset")!;
resetButton.addEventListener("click", () => {
  // prompt the user to confirm
  const input = prompt("Are you sure you want to reset the game? Type Y to confirm: ");

  if (input === "Y" || input === "y") {
    playerPoints.length = 0;
    statusPanel.innerHTML = "No points yet...";
    momentos.length = 0;
    location.reload();
    localStorage.clear();
  }
});

function updatePlayerAndMap(location: leaflet.LatLng) {
  playerMarker.setLatLng(location);
  map.setView(playerMarker.getLatLng());
  locations.push(playerMarker.getLatLng());
  line = leaflet.polyline(locations, { color: "black" }).addTo(map);
  lines.push(line);
  generatePits();
}

function movePlayer(deltaI: number, deltaJ: number) {
  updatePlayerAndMap(
    leaflet.latLng(
      playerMarker.getLatLng().lat + deltaI * TILE_DEGREES,
      playerMarker.getLatLng().lng + deltaJ * TILE_DEGREES
    )
  );
}

const westButton = document.querySelector("#west")!;
westButton.addEventListener("click", () => {
  movePlayer(0, -1);
});

const eastButton = document.querySelector("#east")!;
eastButton.addEventListener("click", () => {
  movePlayer(0, 1);
});

const northButton = document.querySelector("#north")!;
northButton.addEventListener("click", () => {
  movePlayer(1, 0);
});

const southButton = document.querySelector("#south")!;
southButton.addEventListener("click", () => {
  movePlayer(-1, 0);
});

const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusPanel.innerHTML = "No points yet...";

interface Coin {
  readonly i: number;
  readonly j: number;
  readonly serial: number;
}

const playerPoints: Coin[] = [];

function updateStatusPanel() {
  if (playerPoints.length === 0) {
    statusPanel.innerHTML = "No points yet...";
  } else {
    statusPanel.innerHTML = `${playerPoints.length} points accumulated`;
  }
}

interface Momento<T> {
  toMomento(): T;
  fromMomento(momento: T): void;
}

class Cache implements Momento<string>{
  points: Coin[] = [];
  lat: number;
  lng: number;

  constructor(lat: number, lng: number) {
    this.points = [];
    this.lat = lat;
    this.lng = lng;
  }

  createButton(point: Coin, table: HTMLDivElement) {
    const button = document.createElement("button");
    button.innerHTML = "Collect: " + point.i.toFixed(4) + ", " + point.j.toFixed(4) + "#" + point.serial;
    button.addEventListener("click", () => {
      playerPoints.push(point);
      updateStatusPanel();
      this.removePoint(point);
      button.remove();
    });
    // create a cell in the table
    const row = document.createElement("tr");

    row.appendChild(button);
    table.appendChild(row);
  }

  addPoint(point: Coin, table: HTMLDivElement) {
    this.points.push(point);
    this.createButton(point, table);

    this.preserveMomento();
  }

  removePoint(point: Coin) {
    this.points = this.points.filter((p) => p !== point);

    this.preserveMomento();
  }

  toMomento() {
    return JSON.stringify(this.points);
  }

  fromMomento(momento : string) {
    this.points = JSON.parse(momento) as Coin[];
  }

  preserveMomento() {
    const momento = doesMomentoExist(this.lat, this.lng);
    if (momento) {
      momento.points = this.toMomento();
    } else {
      momentos.push({ lat: this.lat, lng: this.lng, points: this.toMomento() });
    }
  }

  loadFromMomento(momento : CacheMomento, table: HTMLDivElement) {
    this.fromMomento(momento.points);
    for (const point of this.points) {
      this.createButton(point, table);
    }
  }
}

interface CacheMomento {
  lat: number;
  lng: number;
  points: string;
}

const momentos: CacheMomento[] = [];

function doesMomentoExist(lat: number, lng: number) {
  return momentos.find((m) => m.lat === lat && m.lng === lng);
}

const pits: leaflet.Layer[] = [];

function makePit(i: number, j: number) {
  const point : Cell = { i, j };

  const cellBounds = world.getCellBounds(point);

  const pit = leaflet.rectangle(cellBounds) as leaflet.Layer;

  pit.bindPopup(() => {
    let value = Math.floor(luck([i, j, "initialValue"].toString()) * 4);
    const container = document.createElement("div");
    const cache = new Cache(point.i, point.j);

    const cointable = document.createElement("table");

    const momento = doesMomentoExist(point.i, point.j);

    if (momento) {
      cache.loadFromMomento(momento, cointable);
      value = cache.points.length;
    } else {
      for (let n = 0; n < value; n++) {
        cache.addPoint({ i: point.i, j: point.j, serial: n }, cointable);
      }
    }

    container.innerHTML = `<div>There is a pit here at "${point.i}, ${point.j}". It has value <span id="value">${value}</span>.</div>`;

    container.appendChild(cointable);

    const storeButton = document.createElement("button");
    storeButton.innerHTML = "Deposit";
    storeButton.addEventListener("click", () => {
      const coin = playerPoints.pop();
      if (coin) {
        value++;
        container.innerHTML = `<div>There is a pit here at "${point.i}, ${point.j}". It has value <span id="value">${value}</span>.</div>`;
        cache.addPoint(coin, cointable);
        updateStatusPanel();
      }
    });
    container.appendChild(storeButton);
    return container;
  });
  pit.addTo(map);
  pits.push(pit);
}

function generatePits() {
  // Delete all current pits
  for (const pit of pits) {
    pit.remove();
  }

  // Generate new pits
  const nearbyCells = world.getCellsNearPoint(playerMarker.getLatLng());

  nearbyCells.forEach((element) => {
    const { i, j } = element;

    if (luck([i, j].toString()) < PIT_SPAWN_PROBABILITY) {
      makePit(i, j);
    }
  });
}

// update the player's location every 100ms
function updatePosition() {
  if (isTracking) {
    navigator.geolocation.getCurrentPosition((position) => {
      updatePlayerAndMap(leaflet.latLng(position.coords.latitude, position.coords.longitude));
      locations = [playerMarker.getLatLng()];
      if (line) line.remove();
    });
  }

  requestAnimationFrame(updatePosition);
}

addEventListener("load", () => {
  generatePits();
  const loadedMomentos = localStorage.getItem("momentos");
  if (loadedMomentos) {
    for (const momento of JSON.parse(loadedMomentos) as CacheMomento[]) {
      momentos.push(momento);
    }
  }
  const loadedPlayerPoints = localStorage.getItem("playerPoints");
  if (loadedPlayerPoints) {
    for (const point of JSON.parse(loadedPlayerPoints) as Coin[]) {
      playerPoints.push(point);
    }
  }
  const loadedLocations = localStorage.getItem("locations");
  if (loadedLocations) {
    locations = JSON.parse(loadedLocations) as leaflet.LatLng[];
  }
  const loadedLines = localStorage.getItem("lines");
  if (loadedLines) {
    for (const line of JSON.parse(loadedLines) as Polyline[]) {
      lines.push(line);
      line.addTo(map);
    }
  }

  console.log(locations[locations.length - 1]);

  const loadedLatLng = locations[locations.length - 1];
  
  if (loadedLatLng !== undefined) {
    updatePlayerAndMap(loadedLatLng);
  } else {
    updatePlayerAndMap(MERRILL_CLASSROOM);
  }

  updateStatusPanel();
});
addEventListener("beforeunload", () => {
  localStorage.setItem("playerPoints", JSON.stringify(playerPoints));
  localStorage.setItem("momentos", JSON.stringify(momentos));
  localStorage.setItem("locations", JSON.stringify(locations));
  localStorage.setItem("lines", JSON.stringify(lines));
});

updatePosition();