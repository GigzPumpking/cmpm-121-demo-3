import "leaflet/dist/leaflet.css";
import "./style.css";
import leaflet from "leaflet";
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

const playerMarker = leaflet.marker(MERRILL_CLASSROOM);
playerMarker.bindTooltip("That's you!");
playerMarker.addTo(map);

const sensorButton = document.querySelector("#sensor")!;
sensorButton.addEventListener("click", () => {
  navigator.geolocation.watchPosition((position) => {
    playerMarker.setLatLng(
      leaflet.latLng(position.coords.latitude, position.coords.longitude)
    );
    map.setView(playerMarker.getLatLng());
  });
});

function movePlayer(deltaI: number, deltaJ: number) {
  playerMarker.setLatLng(
    leaflet.latLng(
      playerMarker.getLatLng().lat + deltaI * TILE_DEGREES,
      playerMarker.getLatLng().lng + deltaJ * TILE_DEGREES
    )
  );
  map.setView(playerMarker.getLatLng());
  
  // Delete all current pits
  for (const pit of pits) {
    pit.remove();
  }

  generatePits();
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
      statusPanel.innerHTML = `${playerPoints.length} points accumulated`;
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

  const cell = world.getCellForPoint(point);

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
        statusPanel.innerHTML = `${playerPoints.length} points accumulated`;
      }
    });
    container.appendChild(storeButton);
    return container;
  });
  pit.addTo(map);
  pits.push(pit);
}

function generatePits() {
  // Generate new pits
  const nearbyCells = world.getCellsNearPoint(playerMarker.getLatLng());

  nearbyCells.forEach((element) => {
    const { i, j } = element;

    if (luck([i, j].toString()) < PIT_SPAWN_PROBABILITY) {
      makePit(i, j);
    }
  });
}

generatePits();
