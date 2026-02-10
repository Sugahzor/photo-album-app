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
  columnWidths: number[] = []; // fr units for each column
  rowHeights: number[] = []; // fr units for each row

  isDraggingFile = false;
  isDraggingFromSidebar = false;
  draggedPhoto: PhotoData | null = null;

  selectedCell: GridCell | null = null;
  isDraggingPhoto = false;

  // Grid resizing
  isDraggingColumnDivider = false;
  isDraggingRowDivider = false;
  draggedDividerIndex = -1;
  dividerDragStart = 0;

  dragStartX = 0;
  dragStartY = 0;
  originalPhotoPosition = { x: 0, y: 0, scale: 1 };

  hoveredCell: GridCell | null = null;
  isPreviewMode = false;

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
    this.columnWidths = Array(this.gridCols).fill(1); // Equal widths
    this.rowHeights = Array(this.gridRows).fill(1); // Equal heights

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
    if (files && files.length > 0) {
      this.handleFiles(Array.from(files));
    }
  }

  onFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      console.log('Files selected:', input.files.length);
      this.handleFiles(Array.from(input.files));
      input.value = '';
    }
  }

  handleFiles(files: File[]) {
    console.log('handleFiles called with', files.length, 'files');

    const imageFiles = files.filter((file) => file.type.startsWith('image/'));
    console.log('Image files:', imageFiles.length);

    const remainingSlots = this.maxPhotos - this.uploadedPhotos.length;
    const filesToProcess = imageFiles.slice(0, remainingSlots);

    if (filesToProcess.length === 0) {
      if (imageFiles.length === 0) {
        alert('No image files selected. Please select image files (jpg, png, etc.)');
      } else {
        alert(
          `Maximum ${this.maxPhotos} photos allowed. You already have ${this.uploadedPhotos.length} photos.`,
        );
      }
      return;
    }

    let loadedCount = 0;
    const totalToLoad = filesToProcess.length;

    filesToProcess.forEach((file, index) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        const result = e.target?.result;
        if (typeof result === 'string') {
          const photoData: PhotoData = {
            id: `photo-${Date.now()}-${Math.random()}-${index}`,
            file: file,
            dataUrl: result,
            position: { x: 50, y: 50, scale: 1 },
            rotation: 0,
          };

          this.uploadedPhotos.push(photoData);
          loadedCount++;

          console.log(`Loaded ${loadedCount}/${totalToLoad}:`, file.name);

          if (loadedCount === totalToLoad) {
            this.uploadedPhotos = [...this.uploadedPhotos];
            console.log('All photos loaded. Total:', this.uploadedPhotos.length);
          }
        }
      };

      reader.onerror = (error) => {
        console.error('Error reading file:', file.name, error);
        loadedCount++;
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

  // ==================== GRID RESIZING ====================

  onColumnDividerMouseDown(event: MouseEvent, columnIndex: number) {
    event.preventDefault();
    event.stopPropagation();

    this.isDraggingColumnDivider = true;
    this.draggedDividerIndex = columnIndex;
    this.dragStartX = event.clientX;

    const onMouseMove = (e: MouseEvent) => this.onColumnDividerMouseMove(e);
    const onMouseUp = () => {
      this.isDraggingColumnDivider = false;
      this.draggedDividerIndex = -1;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }
  onColumnDividerMouseMove(event: MouseEvent) {
    if (!this.isDraggingColumnDivider || this.draggedDividerIndex === -1) return;

    const canvas = document.querySelector('.grid-canvas') as HTMLElement;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const totalWidth = rect.width; // No gap subtraction

    const deltaX = event.clientX - this.dragStartX;
    const deltaFraction = (deltaX / totalWidth) * this.getTotalColumnFr();

    const leftCol = this.draggedDividerIndex;
    const rightCol = this.draggedDividerIndex + 1;

    const minSize = 0.2;

    const newLeftWidth = Math.max(minSize, this.columnWidths[leftCol] + deltaFraction);
    const newRightWidth = Math.max(minSize, this.columnWidths[rightCol] - deltaFraction);

    if (newLeftWidth >= minSize && newRightWidth >= minSize) {
      this.columnWidths[leftCol] = newLeftWidth;
      this.columnWidths[rightCol] = newRightWidth;
      this.dragStartX = event.clientX;
    }
  }

  onRowDividerMouseDown(event: MouseEvent, rowIndex: number) {
    event.preventDefault();
    event.stopPropagation();

    this.isDraggingRowDivider = true;
    this.draggedDividerIndex = rowIndex;
    this.dragStartY = event.clientY;

    const onMouseMove = (e: MouseEvent) => this.onRowDividerMouseMove(e);
    const onMouseUp = () => {
      this.isDraggingRowDivider = false;
      this.draggedDividerIndex = -1;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }
  onRowDividerMouseMove(event: MouseEvent) {
    if (!this.isDraggingRowDivider || this.draggedDividerIndex === -1) return;

    const canvas = document.querySelector('.grid-canvas') as HTMLElement;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const totalHeight = rect.height; // No gap subtraction

    const deltaY = event.clientY - this.dragStartY;
    const deltaFraction = (deltaY / totalHeight) * this.getTotalRowFr();

    const topRow = this.draggedDividerIndex;
    const bottomRow = this.draggedDividerIndex + 1;

    const minSize = 0.2;

    const newTopHeight = Math.max(minSize, this.rowHeights[topRow] + deltaFraction);
    const newBottomHeight = Math.max(minSize, this.rowHeights[bottomRow] - deltaFraction);

    if (newTopHeight >= minSize && newBottomHeight >= minSize) {
      this.rowHeights[topRow] = newTopHeight;
      this.rowHeights[bottomRow] = newBottomHeight;
      this.dragStartY = event.clientY;
    }
  }

  getTotalColumnFr(): number {
    return this.columnWidths.reduce((sum, width) => sum + width, 0);
  }

  getTotalRowFr(): number {
    return this.rowHeights.reduce((sum, height) => sum + height, 0);
  }

  getGridTemplateColumns(): string {
    return this.columnWidths.map((w) => `${w}fr`).join(' ');
  }

  getGridTemplateRows(): string {
    return this.rowHeights.map((h) => `${h}fr`).join(' ');
  }

  resetColumnWidths() {
    this.columnWidths = Array(this.gridCols).fill(1);
  }

  resetRowHeights() {
    this.rowHeights = Array(this.gridRows).fill(1);
  }

  // ==================== GRID MANAGEMENT ====================

  addRow() {
    this.gridRows++;
    this.rowHeights.push(1); // Add new row with default height
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
    this.rowHeights.pop(); // Remove last row height
    this.gridRows--;
  }

  addColumn() {
    this.gridCols++;
    this.columnWidths.push(1); // Add new column with default width
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
    this.columnWidths.pop(); // Remove last column width
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

    this.cells = this.cells.filter((c) => c.id !== cell.id);

    if (this.selectedCell?.id === cell.id) {
      this.selectedCell = null;
    }

    this.autoExpandAdjacentCells(deletedRow, deletedCol, deletedRowSpan, deletedColSpan);
  }

  autoExpandAdjacentCells(
    deletedRow: number,
    deletedCol: number,
    deletedRowSpan: number,
    deletedColSpan: number,
  ) {
    const deletedRowEnd = deletedRow + deletedRowSpan - 1;
    const deletedColEnd = deletedCol + deletedColSpan - 1;

    if (deletedRow > 1) {
      const cellAbove = this.cells.find(
        (c) =>
          c.col === deletedCol && c.colSpan === deletedColSpan && c.row + c.rowSpan === deletedRow,
      );

      if (cellAbove && this.canExpandDownSafely(cellAbove, deletedRowSpan, deletedColSpan)) {
        cellAbove.rowSpan += deletedRowSpan;
        return;
      }
    }

    if (deletedCol > 1) {
      const cellLeft = this.cells.find(
        (c) =>
          c.row === deletedRow && c.rowSpan === deletedRowSpan && c.col + c.colSpan === deletedCol,
      );

      if (cellLeft && this.canExpandRightSafely(cellLeft, deletedColSpan, deletedRowSpan)) {
        cellLeft.colSpan += deletedColSpan;
        return;
      }
    }
  }

  canExpandDownSafely(cell: GridCell, additionalRows: number, requiredColSpan: number): boolean {
    const targetRow = cell.row + cell.rowSpan;
    const targetRowEnd = targetRow + additionalRows - 1;

    if (cell.colSpan !== requiredColSpan) {
      return false;
    }

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

    return targetRowEnd <= this.gridRows;
  }

  canExpandRightSafely(cell: GridCell, additionalCols: number, requiredRowSpan: number): boolean {
    const targetCol = cell.col + cell.colSpan;
    const targetColEnd = targetCol + additionalCols - 1;

    if (cell.rowSpan !== requiredRowSpan) {
      return false;
    }

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
      columnWidths: [...this.columnWidths],
      rowHeights: [...this.rowHeights],
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
    this.columnWidths = [...savedLayout.columnWidths];
    this.rowHeights = [...savedLayout.rowHeights];
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

  togglePreviewMode() {
    this.isPreviewMode = !this.isPreviewMode;
    if (this.isPreviewMode) {
      this.selectedCell = null; // Deselect any selected cell
    }
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

  getColumnDividers(): number[] {
    return Array.from({ length: this.gridCols - 1 }, (_, i) => i);
  }

  getRowDividers(): number[] {
    return Array.from({ length: this.gridRows - 1 }, (_, i) => i);
  }

  getColumnDividerPosition(dividerIndex: number): string {
    // Calculate the position as a percentage
    const sumWidths = this.columnWidths.slice(0, dividerIndex + 1).reduce((a, b) => a + b, 0);
    const totalFr = this.getTotalColumnFr();
    const percentage = (sumWidths / totalFr) * 100;

    return `${percentage}%`;
  }

  getRowDividerPosition(dividerIndex: number): string {
    // Calculate the position as a percentage
    const sumHeights = this.rowHeights.slice(0, dividerIndex + 1).reduce((a, b) => a + b, 0);
    const totalFr = this.getTotalRowFr();
    const percentage = (sumHeights / totalFr) * 100;

    return `${percentage}%`;
  }
}
