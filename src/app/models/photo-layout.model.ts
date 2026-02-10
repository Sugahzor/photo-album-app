export interface GridCell {
  id: string;
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
  photo?: PhotoData;
}

export interface PhotoData {
  id: string;
  file: File;
  dataUrl: string;
  position: {
    x: number; // position within cell (percentage)
    y: number; // position within cell (percentage)
    scale: number; // zoom level (1 = 100%)
  };
  rotation: number; // degrees
}

export interface SavedLayout {
  id?: string;
  name: string;
  gridRows: number;
  gridCols: number;
  columnWidths: number[]; // Width for each column (fr units)
  rowHeights: number[]; // Height for each row (fr units)
  cells: {
    id: string;
    row: number;
    col: number;
    rowSpan: number;
    colSpan: number;
    photoId?: string;
    photoPosition?: {
      x: number;
      y: number;
      scale: number;
    };
    photoRotation?: number;
  }[];
  photos: {
    id: string;
    filename: string;
    dataUrl: string;
  }[];
}
