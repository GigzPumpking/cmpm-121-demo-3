import "leaflet/dist/leaflet.css";
import "./style.css";
import leaflet from "leaflet";
import luck from "./luck";
import "./leafletWorkaround";
import { Board } from "./board";

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

const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusPanel.innerHTML = "No points yet...";

interface Coin {
  readonly i: number;
  readonly j: number;
  readonly serial: number;
}

const playerPoints: Coin[] = [];

class Cache {
  points: Coin[] = [];

  constructor() {
    this.points = [];
  }

  addPoint(point: Coin, table: HTMLDivElement) {
    this.points.push(point);
    const button = document.createElement("button");
    button.innerHTML = "Collect: " + point.i + ", " + point.j + "#" + point.serial;
    button.addEventListener("click", () => {
      playerPoints.push(point);
      statusPanel.innerHTML = `${playerPoints.length} points accumulated`;
      this.removePoint(point);
      button.remove();
    });
    table.appendChild(button);
  }

  removePoint(point: Coin) {
    this.points = this.points.filter((p) => p !== point);
  }
}

function makePit(i: number, j: number) {
  const point = leaflet.latLng({
    lat: MERRILL_CLASSROOM.lat + i * TILE_DEGREES,
    lng: MERRILL_CLASSROOM.lng + j * TILE_DEGREES,
  });

  const cell = world.getCellForPoint(point);

  const cellBounds = world.getCellBounds(cell);

  const pit = leaflet.rectangle(cellBounds) as leaflet.Layer;

  const cellCoordinates: string = world.returnCellCoordinates(cell);

  pit.bindPopup(() => {
    let value = Math.floor(luck([i, j, "initialValue"].toString()) * 4);
    const container = document.createElement("div");
    const cache = new Cache();
    container.innerHTML = `<div>There is a pit here at "${cellCoordinates}". It has value <span id="value">${value}</span>.</div>`;

    // add a table for the coins
    const cointable = document.createElement("table");
    container.appendChild(cointable);
    for (let n = 0; n < value; n++) {
      cache.addPoint({ i: point.lat, j: point.lng, serial: n }, cointable);
    }

    const storeButton = document.createElement("button");
    storeButton.innerHTML = "Deposit";
    storeButton.addEventListener("click", () => {
      const coin = playerPoints.pop();
      if (coin) {
        value++;
        cache.addPoint(coin, container);
        statusPanel.innerHTML = `${playerPoints.length} points accumulated`;
      }
    });
    container.appendChild(storeButton);
    return container;
  });
  pit.addTo(map);
}

for (let i = -NEIGHBORHOOD_SIZE; i < NEIGHBORHOOD_SIZE; i++) {
  for (let j = -NEIGHBORHOOD_SIZE; j < NEIGHBORHOOD_SIZE; j++) {
    if (luck([i, j].toString()) < PIT_SPAWN_PROBABILITY) {
      makePit(i, j);
    }
  }
}
