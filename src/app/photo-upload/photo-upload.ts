import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { GridCell, PhotoData, SavedLayout } from '../models/photo-layout.model';

@Component({
  selector: 'app-photo-upload',
  imports: [CommonModule],
  templateUrl: './photo-upload.html',
  styleUrls: ['./photo-upload.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhotoUploadComponent implements OnInit, OnDestroy {
  // Core state
  cells = signal<GridCell[]>([]);
  uploadedPhotos = signal<PhotoData[]>([]);
  maxPhotos = signal(16);

  gridRows = signal(4);
  gridCols = signal(4);
  columnWidths = signal<number[]>([]);
  rowHeights = signal<number[]>([]);

  // UI state
  isDraggingFile = signal(false);
  isDraggingFromSidebar = signal(false);
  draggedPhoto = signal<PhotoData | null>(null);

  selectedCell = signal<GridCell | null>(null);
  isDraggingPhoto = signal(false);

  isDraggingColumnDivider = signal(false);
  isDraggingRowDivider = signal(false);
  draggedDividerIndex = signal(-1);

  dragStartX = 0;
  dragStartY = 0;
  originalPhotoPosition = { x: 0, y: 0, scale: 1 };

  hoveredCell = signal<GridCell | null>(null);
  isPreviewMode = signal(false);

  // Computed values
  photoCountText = computed(() => `${this.uploadedPhotos().length} / ${this.maxPhotos()}`);
  photosOnCanvas = computed(() => this.cells().filter((c) => c.photo).length);
  visibleCells = computed(() => this.cells().filter((cell) => this.isVisible(cell)));
  totalColumnFr = computed(() => this.columnWidths().reduce((sum, width) => sum + width, 0));
  totalRowFr = computed(() => this.rowHeights().reduce((sum, height) => sum + height, 0));
  gridTemplateColumns = computed(() =>
    this.columnWidths()
      .map((w) => `${w}fr`)
      .join(' '),
  );
  gridTemplateRows = computed(() =>
    this.rowHeights()
      .map((h) => `${h}fr`)
      .join(' '),
  );

  constructor() {}

  ngOnInit() {
    this.initializeGrid();
  }

  ngOnDestroy() {
    this.uploadedPhotos().forEach((photo) => {
      if (photo.dataUrl.startsWith('blob:')) {
        URL.revokeObjectURL(photo.dataUrl);
      }
    });
  }

  // ==================== GRID INITIALIZATION ====================

  initializeGrid() {
    const newCells: GridCell[] = [];
    const cols = this.gridCols();
    const rows = this.gridRows();

    this.columnWidths.set(Array(cols).fill(1));
    this.rowHeights.set(Array(rows).fill(1));

    let id = 0;
    for (let row = 1; row <= rows; row++) {
      for (let col = 1; col <= cols; col++) {
        newCells.push({
          id: `cell-${id++}`,
          row: row,
          col: col,
          rowSpan: 1,
          colSpan: 1,
          photo: undefined,
        });
      }
    }

    this.cells.set(newCells);
  }

  // ==================== FILE UPLOAD ====================

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingFile.set(true);
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingFile.set(false);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingFile.set(false);

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

    const remainingSlots = this.maxPhotos() - this.uploadedPhotos().length;
    const filesToProcess = imageFiles.slice(0, remainingSlots);

    if (filesToProcess.length === 0) {
      if (imageFiles.length === 0) {
        alert('No image files selected. Please select image files (jpg, png, etc.)');
      } else {
        alert(
          `Maximum ${this.maxPhotos()} photos allowed. You already have ${this.uploadedPhotos().length} photos.`,
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

          this.uploadedPhotos.update((photos) => [...photos, photoData]);
          loadedCount++;

          console.log(`Loaded ${loadedCount}/${totalToLoad}:`, file.name);

          if (loadedCount === totalToLoad) {
            console.log('All photos loaded. Total:', this.uploadedPhotos().length);
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
    this.isDraggingFromSidebar.set(true);
    this.draggedPhoto.set(photo);

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'copy';
      event.dataTransfer.setData('text/plain', photo.id);
    }
  }

  onPhotoThumbnailDragEnd() {
    this.isDraggingFromSidebar.set(false);
    this.draggedPhoto.set(null);
    this.hoveredCell.set(null);
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

    this.hoveredCell.set(cell);
  }

  onCellDragLeave(event: DragEvent, cell: GridCell) {
    event.preventDefault();
    event.stopPropagation();

    if (this.hoveredCell()?.id === cell.id) {
      this.hoveredCell.set(null);
    }
  }

  onCellDrop(event: DragEvent, cell: GridCell) {
    event.preventDefault();
    event.stopPropagation();

    if (!this.draggedPhoto()) return;
    if (this.isCellOccupied(cell)) return;

    cell.photo = {
      ...this.draggedPhoto()!,
      position: { x: 50, y: 50, scale: 1 },
    };

    this.selectedCell.set(cell);
    this.draggedPhoto.set(null);
    this.isDraggingFromSidebar.set(false);
    this.hoveredCell.set(null);
  }

  // ==================== GRID RESIZING ====================

  onColumnDividerMouseDown(event: MouseEvent, columnIndex: number) {
    event.preventDefault();
    event.stopPropagation();

    this.isDraggingColumnDivider.set(true);
    this.draggedDividerIndex.set(columnIndex);
    this.dragStartX = event.clientX;

    const onMouseMove = (e: MouseEvent) => this.onColumnDividerMouseMove(e);
    const onMouseUp = () => {
      this.isDraggingColumnDivider.set(false);
      this.draggedDividerIndex.set(-1);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  onColumnDividerMouseMove(event: MouseEvent) {
    if (!this.isDraggingColumnDivider() || this.draggedDividerIndex() === -1) return;

    const canvas = document.querySelector('.grid-canvas') as HTMLElement;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const totalWidth = rect.width;

    const deltaX = event.clientX - this.dragStartX;
    const deltaFraction = (deltaX / totalWidth) * this.totalColumnFr();

    const leftCol = this.draggedDividerIndex();
    const rightCol = this.draggedDividerIndex() + 1;

    const minSize = 0.2;
    const currentWidths = this.columnWidths();

    const newLeftWidth = Math.max(minSize, currentWidths[leftCol] + deltaFraction);
    const newRightWidth = Math.max(minSize, currentWidths[rightCol] - deltaFraction);

    if (newLeftWidth >= minSize && newRightWidth >= minSize) {
      const updatedWidths = [...currentWidths];
      updatedWidths[leftCol] = newLeftWidth;
      updatedWidths[rightCol] = newRightWidth;
      this.columnWidths.set(updatedWidths);
      this.dragStartX = event.clientX;
    }
  }

  onRowDividerMouseDown(event: MouseEvent, rowIndex: number) {
    event.preventDefault();
    event.stopPropagation();

    this.isDraggingRowDivider.set(true);
    this.draggedDividerIndex.set(rowIndex);
    this.dragStartY = event.clientY;

    const onMouseMove = (e: MouseEvent) => this.onRowDividerMouseMove(e);
    const onMouseUp = () => {
      this.isDraggingRowDivider.set(false);
      this.draggedDividerIndex.set(-1);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  onRowDividerMouseMove(event: MouseEvent) {
    if (!this.isDraggingRowDivider() || this.draggedDividerIndex() === -1) return;

    const canvas = document.querySelector('.grid-canvas') as HTMLElement;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const totalHeight = rect.height;

    const deltaY = event.clientY - this.dragStartY;
    const deltaFraction = (deltaY / totalHeight) * this.totalRowFr();

    const topRow = this.draggedDividerIndex();
    const bottomRow = this.draggedDividerIndex() + 1;

    const minSize = 0.2;
    const currentHeights = this.rowHeights();

    const newTopHeight = Math.max(minSize, currentHeights[topRow] + deltaFraction);
    const newBottomHeight = Math.max(minSize, currentHeights[bottomRow] - deltaFraction);

    if (newTopHeight >= minSize && newBottomHeight >= minSize) {
      const updatedHeights = [...currentHeights];
      updatedHeights[topRow] = newTopHeight;
      updatedHeights[bottomRow] = newBottomHeight;
      this.rowHeights.set(updatedHeights);
      this.dragStartY = event.clientY;
    }
  }

  resetColumnWidths() {
    this.columnWidths.set(Array(this.gridCols()).fill(1));
  }

  resetRowHeights() {
    this.rowHeights.set(Array(this.gridRows()).fill(1));
  }

  // ==================== GRID MANAGEMENT ====================

  addRow() {
    this.gridRows.update((rows) => rows + 1);
    this.rowHeights.update((heights) => [...heights, 1]);
    const newRow = this.gridRows();
    const currentCells = this.cells();
    let id = currentCells.length;

    const newCells = [...currentCells];
    for (let col = 1; col <= this.gridCols(); col++) {
      newCells.push({
        id: `cell-${id++}`,
        row: newRow,
        col: col,
        rowSpan: 1,
        colSpan: 1,
        photo: undefined,
      });
    }
    this.cells.set(newCells);
  }

  removeRow() {
    if (this.gridRows() <= 1) return;

    const cellsInLastRow = this.cells().filter((c) => c.row === this.gridRows());
    const hasPhotos = cellsInLastRow.some((c) => c.photo);

    if (hasPhotos && !confirm('This row has photos. Are you sure you want to delete it?')) {
      return;
    }

    this.cells.update((cells) => cells.filter((c) => c.row !== this.gridRows()));
    this.rowHeights.update((heights) => heights.slice(0, -1));
    this.gridRows.update((rows) => rows - 1);
  }

  addColumn() {
    this.gridCols.update((cols) => cols + 1);
    this.columnWidths.update((widths) => [...widths, 1]);
    const newCol = this.gridCols();
    const currentCells = this.cells();
    let id = currentCells.length;

    const newCells = [...currentCells];
    for (let row = 1; row <= this.gridRows(); row++) {
      newCells.push({
        id: `cell-${id++}`,
        row: row,
        col: newCol,
        rowSpan: 1,
        colSpan: 1,
        photo: undefined,
      });
    }
    this.cells.set(newCells);
  }

  removeColumn() {
    if (this.gridCols() <= 1) return;

    const cellsInLastCol = this.cells().filter((c) => c.col === this.gridCols());
    const hasPhotos = cellsInLastCol.some((c) => c.photo);

    if (hasPhotos && !confirm('This column has photos. Are you sure you want to delete it?')) {
      return;
    }

    this.cells.update((cells) => cells.filter((c) => c.col !== this.gridCols()));
    this.columnWidths.update((widths) => widths.slice(0, -1));
    this.gridCols.update((cols) => cols - 1);
  }

  // ==================== CELL INTERACTION ====================

  onCellClick(cell: GridCell, event: MouseEvent) {
    if (
      (event.target as HTMLElement).closest('.cell-controls') ||
      (event.target as HTMLElement).closest('.span-controls')
    ) {
      return;
    }
    this.selectedCell.set(cell);
  }

  onCanvasClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this.selectedCell.set(null);
    }
  }

  togglePreviewMode() {
    this.isPreviewMode.update((mode) => !mode);
    if (this.isPreviewMode()) {
      this.selectedCell.set(null);
    }
  }

  removePhotoFromCell(cell: GridCell, event: Event) {
    event.stopPropagation();
    cell.photo = undefined;
    if (this.selectedCell()?.id === cell.id) {
      this.selectedCell.set(null);
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

    this.cells.update((cells) => cells.filter((c) => c.id !== cell.id));

    if (this.selectedCell()?.id === cell.id) {
      this.selectedCell.set(null);
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
      const cellAbove = this.cells().find(
        (c) =>
          c.col === deletedCol && c.colSpan === deletedColSpan && c.row + c.rowSpan === deletedRow,
      );

      if (cellAbove && this.canExpandDownSafely(cellAbove, deletedRowSpan, deletedColSpan)) {
        cellAbove.rowSpan += deletedRowSpan;
        return;
      }
    }

    if (deletedCol > 1) {
      const cellLeft = this.cells().find(
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
        const blocking = this.cells().find(
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

    return targetRowEnd <= this.gridRows();
  }

  canExpandRightSafely(cell: GridCell, additionalCols: number, requiredRowSpan: number): boolean {
    const targetCol = cell.col + cell.colSpan;
    const targetColEnd = targetCol + additionalCols - 1;

    if (cell.rowSpan !== requiredRowSpan) {
      return false;
    }

    for (let col = targetCol; col <= targetColEnd; col++) {
      for (let row = cell.row; row < cell.row + cell.rowSpan; row++) {
        const blocking = this.cells().find(
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

    return targetColEnd <= this.gridCols();
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

    this.isDraggingPhoto.set(true);
    this.selectedCell.set(cell);
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    this.originalPhotoPosition = { ...cell.photo.position };

    const onMouseMove = (e: MouseEvent) => this.onPhotoMouseMove(e, cell);
    const onMouseUp = () => {
      this.isDraggingPhoto.set(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  onPhotoMouseMove(event: MouseEvent, cell: GridCell) {
    if (!this.isDraggingPhoto() || !cell.photo) return;

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
    if (cell.row + cell.rowSpan > this.gridRows()) {
      return false;
    }

    for (let col = cell.col; col < cell.col + cell.colSpan; col++) {
      const targetRow = cell.row + cell.rowSpan;
      const blocking = this.cells().find(
        (c) => c.id !== cell.id && c.row === targetRow && c.col === col,
      );

      if (blocking && (blocking.photo || blocking.rowSpan > 1 || blocking.colSpan > 1)) {
        return false;
      }
    }

    return true;
  }

  canIncreaseColSpan(cell: GridCell): boolean {
    if (cell.col + cell.colSpan > this.gridCols()) {
      return false;
    }

    for (let row = cell.row; row < cell.row + cell.rowSpan; row++) {
      const targetCol = cell.col + cell.colSpan;
      const blocking = this.cells().find(
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
      this.cells.update((cells) =>
        cells.filter((c) => !(c.id !== cell.id && c.row === targetRow && c.col === col)),
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
      this.cells.update((cells) =>
        cells.filter((c) => !(c.id !== cell.id && c.row === row && c.col === targetCol)),
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

    const maxPossibleRows = this.gridRows() - cell.row + 1;

    for (let targetSpan = cell.rowSpan + 1; targetSpan <= maxPossibleRows; targetSpan++) {
      let canExpand = true;
      const cellsToDelete: GridCell[] = [];

      for (let col = cell.col; col < cell.col + cell.colSpan; col++) {
        const targetRow = cell.row + targetSpan - 1;
        const blocking = this.cells().find(
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
        this.cells.update((cells) => cells.filter((existing) => existing.id !== c.id));
      });

      cell.rowSpan = targetSpan;
    }
  }

  expandToFillRow(cell: GridCell, event: Event) {
    event.stopPropagation();

    const maxPossibleCols = this.gridCols() - cell.col + 1;

    for (let targetSpan = cell.colSpan + 1; targetSpan <= maxPossibleCols; targetSpan++) {
      let canExpand = true;
      const cellsToDelete: GridCell[] = [];

      for (let row = cell.row; row < cell.row + cell.rowSpan; row++) {
        const targetCol = cell.col + targetSpan - 1;
        const blocking = this.cells().find(
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
        this.cells.update((cells) => cells.filter((existing) => existing.id !== c.id));
      });

      cell.colSpan = targetSpan;
    }
  }

  canExpandToFillColumn(cell: GridCell): boolean {
    if (cell.row + cell.rowSpan > this.gridRows()) {
      return false;
    }

    for (let col = cell.col; col < cell.col + cell.colSpan; col++) {
      const targetRow = cell.row + cell.rowSpan;
      const blocking = this.cells().find(
        (c) => c.id !== cell.id && c.row === targetRow && c.col === col,
      );

      if (blocking && !blocking.photo && blocking.rowSpan === 1 && blocking.colSpan === 1) {
        return true;
      }
    }

    return false;
  }

  canExpandToFillRow(cell: GridCell): boolean {
    if (cell.col + cell.colSpan > this.gridCols()) {
      return false;
    }

    for (let row = cell.row; row < cell.row + cell.rowSpan; row++) {
      const targetCol = cell.col + cell.colSpan;
      const blocking = this.cells().find(
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
    return this.cells().some((c) => {
      if (c.id === cell.id) return false;

      const occupiesRow = cell.row >= c.row && cell.row < c.row + c.rowSpan;
      const occupiesCol = cell.col >= c.col && cell.col < c.col + c.colSpan;

      return occupiesRow && occupiesCol;
    });
  }

  isVisible(cell: GridCell): boolean {
    return !this.cells().some((c) => {
      if (c.id === cell.id) return false;

      const coveredByRow = cell.row >= c.row && cell.row < c.row + c.rowSpan;
      const coveredByCol = cell.col >= c.col && cell.col < c.col + c.colSpan;

      return coveredByRow && coveredByCol;
    });
  }

  clearCanvas() {
    if (confirm('Are you sure you want to remove all photos?')) {
      this.cells.update((cells) => {
        const updatedCells = [...cells];
        updatedCells.forEach((cell) => (cell.photo = undefined));
        return updatedCells;
      });
      this.selectedCell.set(null);
    }
  }

  // ==================== DATA EXPORT/IMPORT ====================

  exportLayoutData(): SavedLayout {
    return {
      name: 'My Photo Album',
      gridRows: this.gridRows(),
      gridCols: this.gridCols(),
      columnWidths: [...this.columnWidths()],
      rowHeights: [...this.rowHeights()],
      cells: this.cells()
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
      photos: this.uploadedPhotos().map((photo) => ({
        id: photo.id,
        filename: photo.file.name,
        dataUrl: photo.dataUrl,
      })),
    };
  }

  loadLayoutData(savedLayout: SavedLayout) {
    this.gridRows.set(savedLayout.gridRows);
    this.gridCols.set(savedLayout.gridCols);
    this.columnWidths.set([...savedLayout.columnWidths]);
    this.rowHeights.set([...savedLayout.rowHeights]);

    const newPhotos: PhotoData[] = [];
    const newCells: GridCell[] = [];

    savedLayout.photos.forEach((savedPhoto) => {
      newPhotos.push({
        id: savedPhoto.id,
        file: new File([], savedPhoto.filename),
        dataUrl: savedPhoto.dataUrl,
        position: { x: 50, y: 50, scale: 1 },
        rotation: 0,
      });
    });

    savedLayout.cells.forEach((savedCell) => {
      const photo = savedCell.photoId
        ? newPhotos.find((p) => p.id === savedCell.photoId)
        : undefined;

      newCells.push({
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

    this.uploadedPhotos.set(newPhotos);
    this.cells.set(newCells);
  }

  async saveToBackend() {
    const layoutData = this.exportLayoutData();
    console.log('Saving layout:', layoutData);
    alert('Layout data logged to console. Check browser console (F12)');
  }

  // ==================== VIEW HELPERS ====================

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
    return this.hoveredCell()?.id === cell.id;
  }

  getColumnDividers(): number[] {
    return Array.from({ length: this.gridCols() - 1 }, (_, i) => i);
  }

  getRowDividers(): number[] {
    return Array.from({ length: this.gridRows() - 1 }, (_, i) => i);
  }

  getColumnDividerPosition(dividerIndex: number): string {
    const sumWidths = this.columnWidths()
      .slice(0, dividerIndex + 1)
      .reduce((a, b) => a + b, 0);
    const totalFr = this.totalColumnFr();
    const percentage = (sumWidths / totalFr) * 100;

    return `${percentage}%`;
  }

  getRowDividerPosition(dividerIndex: number): string {
    const sumHeights = this.rowHeights()
      .slice(0, dividerIndex + 1)
      .reduce((a, b) => a + b, 0);
    const totalFr = this.totalRowFr();
    const percentage = (sumHeights / totalFr) * 100;

    return `${percentage}%`;
  }
}
