import leaflet from "leaflet";

export interface Cell {
    readonly i: number;
    readonly j: number;
}

export class Board {

    readonly tileWidth: number;
    readonly tileVisibilityRadius: number;

    private readonly knownCells: Map<string, Cell>;

    constructor(tileWidth: number, tileVisibilityRadius: number) {
        this.tileWidth = tileWidth;
        this.tileVisibilityRadius = tileVisibilityRadius;
        this.knownCells = new Map();
    }

    private getCanonicalCell(cell: Cell): Cell {
        const { i, j } = cell;
        const key = [i, j].toString();
        const foundCell = this.knownCells.get(key);
        if (foundCell) {
            return foundCell;
        }
        const canonicalCell = { i, j };
        this.knownCells.set(key, canonicalCell);
        return canonicalCell;
    }

    getCellForPoint(point: leaflet.LatLng): Cell {
        return this.getCanonicalCell({
            i: Math.floor(point.lat / this.tileWidth),
            j: Math.floor(point.lng / this.tileWidth),
        });
    }

    getCellBounds(cell: Cell): leaflet.LatLngBounds {
        const { i, j } = cell;
        return leaflet.latLngBounds([
            [i * this.tileWidth, j * this.tileWidth],
            [(i + 1) * this.tileWidth, (j + 1) * this.tileWidth],
        ]);
        
    }

    getCellsNearPoint(point: leaflet.LatLng): Cell[] {
        const resultCells: Cell[] = [];
        const originCell = this.getCellForPoint(point);

        for (let i = -this.tileVisibilityRadius; i <= this.tileVisibilityRadius; i++) {
            for (let j = -this.tileVisibilityRadius; j <= this.tileVisibilityRadius; j++) {
                const cell = this.getCanonicalCell({ i: originCell.i + i, j: originCell.j + j });
                resultCells.push(cell);
            }
        }

        return resultCells;
    }

    returnCellCoordinates(cell: Cell): string {
        return `(${cell.i}, ${cell.j})`;
    }
}