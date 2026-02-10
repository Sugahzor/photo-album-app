import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GridCell, PhotoData, SavedLayout } from '../models/photo-layout.model';

@Component({
  selector: 'app-photo-upload',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './photo-upload.html',
  styleUrls: ['./photo-upload.css'],
})
export class PhotoUploadComponent implements OnInit, OnDestroy {
  cells: GridCell[] = [];
  uploadedPhotos: PhotoData[] = [];
  maxPhotos = 16;

  gridRows = 4;
  gridCols = 4;

  isDraggingFile = false;
  isDraggingFromSidebar = false;
  draggedPhoto: PhotoData | null = null;

  selectedCell: GridCell | null = null;
  isDraggingPhoto = false;

  dragStartX = 0;
  dragStartY = 0;
  originalPhotoPosition = { x: 0, y: 0, scale: 1 };

  hoveredCell: GridCell | null = null;

  ngOnInit() {
    this.initializeGrid();
  }

  ngOnDestroy() {
    this.uploadedPhotos.forEach((photo) => {
      if (photo.dataUrl.startsWith('blob:')) {
        URL.revokeObjectURL(photo.dataUrl);
      }
    });
  }

  // ==================== GRID INITIALIZATION ====================

  initializeGrid() {
    this.cells = [];
    let id = 0;
    for (let row = 1; row <= this.gridRows; row++) {
      for (let col = 1; col <= this.gridCols; col++) {
        this.cells.push({
          id: `cell-${id++}`,
          row: row,
          col: col,
          rowSpan: 1,
          colSpan: 1,
          photo: undefined,
        });
      }
    }
  }

  // ==================== FILE UPLOAD ====================

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingFile = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingFile = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingFile = false;

    const files = event.dataTransfer?.files;
    if (files) {
      this.handleFiles(Array.from(files));
    }
  }

  onFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.handleFiles(Array.from(input.files));
    }
  }

  handleFiles(files: File[]) {
    const imageFiles = files.filter((file) => file.type.startsWith('image/'));
    const remainingSlots = this.maxPhotos - this.uploadedPhotos.length;
    const filesToProcess = imageFiles.slice(0, remainingSlots);

    filesToProcess.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const photoData: PhotoData = {
          id: `photo-${Date.now()}-${Math.random()}`,
          file: file,
          dataUrl: e.target?.result as string,
          position: { x: 50, y: 50, scale: 1 },
          rotation: 0,
        };
        this.uploadedPhotos.push(photoData);
      };
      reader.readAsDataURL(file);
    });
  }

  // ==================== DRAG FROM SIDEBAR TO GRID ====================

  onPhotoThumbnailDragStart(event: DragEvent, photo: PhotoData) {
    this.isDraggingFromSidebar = true;
    this.draggedPhoto = photo;

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'copy';
      event.dataTransfer.setData('text/plain', photo.id);
    }
  }

  onPhotoThumbnailDragEnd() {
    this.isDraggingFromSidebar = false;
    this.draggedPhoto = null;
    this.hoveredCell = null;
  }

  onCanvasDragOver(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
  }

  onCellDragOver(event: DragEvent, cell: GridCell) {
    event.preventDefault();
    event.stopPropagation();

    if (this.isCellOccupied(cell)) {
      return;
    }

    this.hoveredCell = cell;
  }

  onCellDragLeave(event: DragEvent, cell: GridCell) {
    event.preventDefault();
    event.stopPropagation();

    if (this.hoveredCell?.id === cell.id) {
      this.hoveredCell = null;
    }
  }

  onCellDrop(event: DragEvent, cell: GridCell) {
    event.preventDefault();
    event.stopPropagation();

    if (!this.draggedPhoto) return;
    if (this.isCellOccupied(cell)) return;

    cell.photo = {
      ...this.draggedPhoto,
      position: { x: 50, y: 50, scale: 1 },
    };

    this.selectedCell = cell;
    this.draggedPhoto = null;
    this.isDraggingFromSidebar = false;
    this.hoveredCell = null;
  }

  // ==================== GRID MANAGEMENT ====================

  addRow() {
    this.gridRows++;
    const newRow = this.gridRows;
    let id = this.cells.length;

    for (let col = 1; col <= this.gridCols; col++) {
      this.cells.push({
        id: `cell-${id++}`,
        row: newRow,
        col: col,
        rowSpan: 1,
        colSpan: 1,
        photo: undefined,
      });
    }
  }

  removeRow() {
    if (this.gridRows <= 1) return;

    const cellsInLastRow = this.cells.filter((c) => c.row === this.gridRows);
    const hasPhotos = cellsInLastRow.some((c) => c.photo);

    if (hasPhotos && !confirm('This row has photos. Are you sure you want to delete it?')) {
      return;
    }

    this.cells = this.cells.filter((c) => c.row !== this.gridRows);
    this.gridRows--;
  }

  addColumn() {
    this.gridCols++;
    const newCol = this.gridCols;
    let id = this.cells.length;

    for (let row = 1; row <= this.gridRows; row++) {
      this.cells.push({
        id: `cell-${id++}`,
        row: row,
        col: newCol,
        rowSpan: 1,
        colSpan: 1,
        photo: undefined,
      });
    }
  }

  removeColumn() {
    if (this.gridCols <= 1) return;

    const cellsInLastCol = this.cells.filter((c) => c.col === this.gridCols);
    const hasPhotos = cellsInLastCol.some((c) => c.photo);

    if (hasPhotos && !confirm('This column has photos. Are you sure you want to delete it?')) {
      return;
    }

    this.cells = this.cells.filter((c) => c.col !== this.gridCols);
    this.gridCols--;
  }

  // ==================== CELL INTERACTION ====================

  onCellClick(cell: GridCell, event: MouseEvent) {
    if (
      (event.target as HTMLElement).closest('.cell-controls') ||
      (event.target as HTMLElement).closest('.span-controls')
    ) {
      return;
    }
    this.selectedCell = cell;
  }

  onCanvasClick(event: MouseEvent) {
    // Only deselect if clicking directly on the canvas, not on cells
    if (event.target === event.currentTarget) {
      this.selectedCell = null;
    }
  }

  removePhotoFromCell(cell: GridCell, event: Event) {
    event.stopPropagation();
    cell.photo = undefined;
    if (this.selectedCell?.id === cell.id) {
      this.selectedCell = null;
    }
  }

  deleteCell(cell: GridCell, event: Event) {
    event.stopPropagation();

    if (cell.photo && !confirm('This cell has a photo. Are you sure you want to delete it?')) {
      return;
    }

    const deletedRow = cell.row;
    const deletedCol = cell.col;
    const deletedRowSpan = cell.rowSpan;
    const deletedColSpan = cell.colSpan;

    // Remove the cell
    this.cells = this.cells.filter((c) => c.id !== cell.id);

    if (this.selectedCell?.id === cell.id) {
      this.selectedCell = null;
    }

    // Auto-expand adjacent cells with proper boundary checks
    this.autoExpandAdjacentCells(deletedRow, deletedCol, deletedRowSpan, deletedColSpan);
  }

  autoExpandAdjacentCells(
    deletedRow: number,
    deletedCol: number,
    deletedRowSpan: number,
    deletedColSpan: number,
  ) {
    // Calculate the area that was freed up
    const deletedRowEnd = deletedRow + deletedRowSpan - 1;
    const deletedColEnd = deletedCol + deletedColSpan - 1;

    // Try to expand cell above (same column position and width)
    if (deletedRow > 1) {
      const cellAbove = this.cells.find(
        (c) =>
          c.col === deletedCol && c.colSpan === deletedColSpan && c.row + c.rowSpan === deletedRow,
      );

      if (cellAbove && this.canExpandDownSafely(cellAbove, deletedRowSpan, deletedColSpan)) {
        cellAbove.rowSpan += deletedRowSpan;
        return; // Successfully expanded, stop here
      }
    }

    // Try to expand cell to the left (same row position and height)
    if (deletedCol > 1) {
      const cellLeft = this.cells.find(
        (c) =>
          c.row === deletedRow && c.rowSpan === deletedRowSpan && c.col + c.colSpan === deletedCol,
      );

      if (cellLeft && this.canExpandRightSafely(cellLeft, deletedColSpan, deletedRowSpan)) {
        cellLeft.colSpan += deletedColSpan;
        return; // Successfully expanded, stop here
      }
    }
  }

  canExpandDownSafely(cell: GridCell, additionalRows: number, requiredColSpan: number): boolean {
    // Check if cell can expand down by additionalRows
    // Must match the exact column span and not hit any other cells
    const targetRow = cell.row + cell.rowSpan;
    const targetRowEnd = targetRow + additionalRows - 1;

    // Verify the freed space matches our column span exactly
    if (cell.colSpan !== requiredColSpan) {
      return false;
    }

    // Check if the space is completely clear
    for (let row = targetRow; row <= targetRowEnd; row++) {
      for (let col = cell.col; col < cell.col + cell.colSpan; col++) {
        const blocking = this.cells.find(
          (c) =>
            c.id !== cell.id &&
            c.row <= row &&
            c.row + c.rowSpan > row &&
            c.col <= col &&
            c.col + c.colSpan > col,
        );
        if (blocking) {
          return false;
        }
      }
    }

    // Check if within grid bounds
    return targetRowEnd <= this.gridRows;
  }

  canExpandRightSafely(cell: GridCell, additionalCols: number, requiredRowSpan: number): boolean {
    // Check if cell can expand right by additionalCols
    // Must match the exact row span and not hit any other cells
    const targetCol = cell.col + cell.colSpan;
    const targetColEnd = targetCol + additionalCols - 1;

    // Verify the freed space matches our row span exactly
    if (cell.rowSpan !== requiredRowSpan) {
      return false;
    }

    // Check if the space is completely clear
    for (let col = targetCol; col <= targetColEnd; col++) {
      for (let row = cell.row; row < cell.row + cell.rowSpan; row++) {
        const blocking = this.cells.find(
          (c) =>
            c.id !== cell.id &&
            c.row <= row &&
            c.row + c.rowSpan > row &&
            c.col <= col &&
            c.col + c.colSpan > col,
        );
        if (blocking) {
          return false;
        }
      }
    }

    // Check if within grid bounds
    return targetColEnd <= this.gridCols;
  }

  canExpandDown(cell: GridCell, additionalRows: number): boolean {
    return this.canExpandDownSafely(cell, additionalRows, cell.colSpan);
  }

  canExpandRight(cell: GridCell, additionalCols: number): boolean {
    return this.canExpandRightSafely(cell, additionalCols, cell.rowSpan);
  }

  // ==================== PHOTO MANIPULATION ====================

  onPhotoMouseDown(event: MouseEvent, cell: GridCell) {
    if (!cell.photo) return;

    event.preventDefault();
    event.stopPropagation();

    this.isDraggingPhoto = true;
    this.selectedCell = cell;
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    this.originalPhotoPosition = { ...cell.photo.position };

    const onMouseMove = (e: MouseEvent) => this.onPhotoMouseMove(e, cell);
    const onMouseUp = () => {
      this.isDraggingPhoto = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  onPhotoMouseMove(event: MouseEvent, cell: GridCell) {
    if (!this.isDraggingPhoto || !cell.photo) return;

    const deltaX = event.clientX - this.dragStartX;
    const deltaY = event.clientY - this.dragStartY;

    const cellElement = document.getElementById(cell.id);
    if (!cellElement) return;

    const cellWidth = cellElement.offsetWidth;
    const cellHeight = cellElement.offsetHeight;

    const deltaXPercent = (deltaX / cellWidth) * 100;
    const deltaYPercent = (deltaY / cellHeight) * 100;

    cell.photo.position.x = this.originalPhotoPosition.x + deltaXPercent;
    cell.photo.position.y = this.originalPhotoPosition.y + deltaYPercent;
  }

  onPhotoWheel(event: WheelEvent, cell: GridCell) {
    if (!cell.photo) return;

    event.preventDefault();
    event.stopPropagation();

    const delta = event.deltaY > 0 ? -0.05 : 0.05;
    cell.photo.position.scale = Math.max(0.1, Math.min(5, cell.photo.position.scale + delta));
  }

  // ==================== CELL SPAN MANAGEMENT ====================

  canIncreaseRowSpan(cell: GridCell): boolean {
    if (cell.row + cell.rowSpan > this.gridRows) {
      return false;
    }

    for (let col = cell.col; col < cell.col + cell.colSpan; col++) {
      const targetRow = cell.row + cell.rowSpan;
      const blocking = this.cells.find(
        (c) => c.id !== cell.id && c.row === targetRow && c.col === col,
      );

      if (blocking && (blocking.photo || blocking.rowSpan > 1 || blocking.colSpan > 1)) {
        return false;
      }
    }

    return true;
  }

  canIncreaseColSpan(cell: GridCell): boolean {
    if (cell.col + cell.colSpan > this.gridCols) {
      return false;
    }

    for (let row = cell.row; row < cell.row + cell.rowSpan; row++) {
      const targetCol = cell.col + cell.colSpan;
      const blocking = this.cells.find(
        (c) => c.id !== cell.id && c.row === row && c.col === targetCol,
      );

      if (blocking && (blocking.photo || blocking.rowSpan > 1 || blocking.colSpan > 1)) {
        return false;
      }
    }

    return true;
  }

  increaseRowSpan(cell: GridCell, event: Event) {
    event.stopPropagation();

    if (!this.canIncreaseRowSpan(cell)) {
      return;
    }

    for (let col = cell.col; col < cell.col + cell.colSpan; col++) {
      const targetRow = cell.row + cell.rowSpan;
      this.cells = this.cells.filter(
        (c) => !(c.id !== cell.id && c.row === targetRow && c.col === col),
      );
    }

    cell.rowSpan++;
  }

  decreaseRowSpan(cell: GridCell, event: Event) {
    event.stopPropagation();
    if (cell.rowSpan <= 1) return;
    cell.rowSpan--;
  }

  increaseColSpan(cell: GridCell, event: Event) {
    event.stopPropagation();

    if (!this.canIncreaseColSpan(cell)) {
      return;
    }

    for (let row = cell.row; row < cell.row + cell.rowSpan; row++) {
      const targetCol = cell.col + cell.colSpan;
      this.cells = this.cells.filter(
        (c) => !(c.id !== cell.id && c.row === row && c.col === targetCol),
      );
    }

    cell.colSpan++;
  }

  decreaseColSpan(cell: GridCell, event: Event) {
    event.stopPropagation();
    if (cell.colSpan <= 1) return;
    cell.colSpan--;
  }

  expandToFillColumn(cell: GridCell, event: Event) {
    event.stopPropagation();

    const maxPossibleRows = this.gridRows - cell.row + 1;

    for (let targetSpan = cell.rowSpan + 1; targetSpan <= maxPossibleRows; targetSpan++) {
      let canExpand = true;
      const cellsToDelete: GridCell[] = [];

      for (let col = cell.col; col < cell.col + cell.colSpan; col++) {
        const targetRow = cell.row + targetSpan - 1;
        const blocking = this.cells.find(
          (c) => c.id !== cell.id && c.row === targetRow && c.col === col,
        );

        if (blocking) {
          if (blocking.photo || blocking.rowSpan > 1 || blocking.colSpan > 1) {
            canExpand = false;
            break;
          }
          cellsToDelete.push(blocking);
        }
      }

      if (!canExpand) {
        break;
      }

      cellsToDelete.forEach((c) => {
        this.cells = this.cells.filter((existing) => existing.id !== c.id);
      });

      cell.rowSpan = targetSpan;
    }
  }

  expandToFillRow(cell: GridCell, event: Event) {
    event.stopPropagation();

    const maxPossibleCols = this.gridCols - cell.col + 1;

    for (let targetSpan = cell.colSpan + 1; targetSpan <= maxPossibleCols; targetSpan++) {
      let canExpand = true;
      const cellsToDelete: GridCell[] = [];

      for (let row = cell.row; row < cell.row + cell.rowSpan; row++) {
        const targetCol = cell.col + targetSpan - 1;
        const blocking = this.cells.find(
          (c) => c.id !== cell.id && c.row === row && c.col === targetCol,
        );

        if (blocking) {
          if (blocking.photo || blocking.rowSpan > 1 || blocking.colSpan > 1) {
            canExpand = false;
            break;
          }
          cellsToDelete.push(blocking);
        }
      }

      if (!canExpand) {
        break;
      }

      cellsToDelete.forEach((c) => {
        this.cells = this.cells.filter((existing) => existing.id !== c.id);
      });

      cell.colSpan = targetSpan;
    }
  }

  canExpandToFillColumn(cell: GridCell): boolean {
    if (cell.row + cell.rowSpan > this.gridRows) {
      return false;
    }

    for (let col = cell.col; col < cell.col + cell.colSpan; col++) {
      const targetRow = cell.row + cell.rowSpan;
      const blocking = this.cells.find(
        (c) => c.id !== cell.id && c.row === targetRow && c.col === col,
      );

      if (blocking && !blocking.photo && blocking.rowSpan === 1 && blocking.colSpan === 1) {
        return true;
      }
    }

    return false;
  }

  canExpandToFillRow(cell: GridCell): boolean {
    if (cell.col + cell.colSpan > this.gridCols) {
      return false;
    }

    for (let row = cell.row; row < cell.row + cell.rowSpan; row++) {
      const targetCol = cell.col + cell.colSpan;
      const blocking = this.cells.find(
        (c) => c.id !== cell.id && c.row === row && c.col === targetCol,
      );

      if (blocking && !blocking.photo && blocking.rowSpan === 1 && blocking.colSpan === 1) {
        return true;
      }
    }

    return false;
  }

  // ==================== HELPER METHODS ====================

  isCellOccupied(cell: GridCell): boolean {
    return this.cells.some((c) => {
      if (c.id === cell.id) return false;

      const occupiesRow = cell.row >= c.row && cell.row < c.row + c.rowSpan;
      const occupiesCol = cell.col >= c.col && cell.col < c.col + c.colSpan;

      return occupiesRow && occupiesCol;
    });
  }

  isVisible(cell: GridCell): boolean {
    return !this.cells.some((c) => {
      if (c.id === cell.id) return false;

      const coveredByRow = cell.row >= c.row && cell.row < c.row + c.rowSpan;
      const coveredByCol = cell.col >= c.col && cell.col < c.col + c.colSpan;

      return coveredByRow && coveredByCol;
    });
  }

  clearCanvas() {
    if (confirm('Are you sure you want to remove all photos?')) {
      this.cells.forEach((cell) => (cell.photo = undefined));
      this.selectedCell = null;
    }
  }

  // ==================== DATA EXPORT/IMPORT ====================

  exportLayoutData(): SavedLayout {
    return {
      name: 'My Photo Album',
      gridRows: this.gridRows,
      gridCols: this.gridCols,
      cells: this.cells
        .filter((cell) => this.isVisible(cell))
        .map((cell) => ({
          id: cell.id,
          row: cell.row,
          col: cell.col,
          rowSpan: cell.rowSpan,
          colSpan: cell.colSpan,
          photoId: cell.photo?.id,
          photoPosition: cell.photo?.position,
          photoRotation: cell.photo?.rotation,
        })),
      photos: this.uploadedPhotos.map((photo) => ({
        id: photo.id,
        filename: photo.file.name,
        dataUrl: photo.dataUrl,
      })),
    };
  }

  loadLayoutData(savedLayout: SavedLayout) {
    this.gridRows = savedLayout.gridRows;
    this.gridCols = savedLayout.gridCols;
    this.cells = [];
    this.uploadedPhotos = [];

    savedLayout.photos.forEach((savedPhoto) => {
      this.uploadedPhotos.push({
        id: savedPhoto.id,
        file: new File([], savedPhoto.filename),
        dataUrl: savedPhoto.dataUrl,
        position: { x: 50, y: 50, scale: 1 },
        rotation: 0,
      });
    });

    savedLayout.cells.forEach((savedCell) => {
      const photo = savedCell.photoId
        ? this.uploadedPhotos.find((p) => p.id === savedCell.photoId)
        : undefined;

      this.cells.push({
        id: savedCell.id,
        row: savedCell.row,
        col: savedCell.col,
        rowSpan: savedCell.rowSpan,
        colSpan: savedCell.colSpan,
        photo:
          photo && savedCell.photoPosition
            ? {
                ...photo,
                position: savedCell.photoPosition,
                rotation: savedCell.photoRotation || 0,
              }
            : undefined,
      });
    });
  }

  async saveToBackend() {
    const layoutData = this.exportLayoutData();
    console.log('Saving layout:', layoutData);
    alert('Layout data logged to console. Check browser console (F12)');
  }

  // ==================== VIEW HELPERS ====================

  getPhotoCountText(): string {
    return `${this.uploadedPhotos.length} / ${this.maxPhotos}`;
  }

  getPhotosOnCanvas(): number {
    return this.cells.filter((c) => c.photo).length;
  }

  getCellStyle(cell: GridCell) {
    return {
      'grid-row': `${cell.row} / span ${cell.rowSpan}`,
      'grid-column': `${cell.col} / span ${cell.colSpan}`,
    };
  }

  getPhotoStyle(photo: PhotoData) {
    return {
      transform: `translate(-50%, -50%) translate(${photo.position.x}%, ${photo.position.y}%) scale(${photo.position.scale}) rotate(${photo.rotation}deg)`,
    };
  }

  isHovered(cell: GridCell): boolean {
    return this.hoveredCell?.id === cell.id;
  }

  getVisibleCells(): GridCell[] {
    return this.cells.filter((cell) => this.isVisible(cell));
  }
}
