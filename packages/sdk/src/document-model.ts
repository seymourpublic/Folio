export type Point = { x: number; y: number };

export type CommentStatus = "open" | "inProgress" | "completed" | "cancelled";

export type Reply = {
  id: string;
  author: string;
  text: string;
  createdAt: number;
  /** data: URL of a recorded audio clip (webm/opus), if this reply is a voice comment. */
  audioDataUrl?: string;
  /** data: URL of an attached image, if this reply has one. */
  imageDataUrl?: string;
};

export type FontFamily = "helvetica" | "times" | "courier" | "noto";

type AnnotationBase = {
  id: string;
  resolved?: boolean;
  status?: CommentStatus;
  replies?: Reply[];
};

type TextStyle = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  align?: "left" | "center" | "right";
  fontFamily?: FontFamily;
  direction?: "ltr" | "rtl";
};

export type HighlightAnnotation = AnnotationBase & {
  type: "highlight";
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
};

/** Rect-shaped text markup drawn as a line at the top (underline), middle-strike (strikeout), or wavy baseline (squiggly). */
export type MarkupAnnotation = AnnotationBase & {
  type: "underline" | "strikeout" | "squiggly";
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
};

export type InkAnnotation = AnnotationBase & {
  type: "ink";
  points: Point[];
  color: string;
  strokeWidth: number;
};

export type TextAnnotation = AnnotationBase &
  TextStyle & {
    type: "text";
    x: number;
    y: number;
    text: string;
    fontSize: number;
    color: string;
  };

export type RectAnnotation = AnnotationBase & {
  type: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  filled?: boolean;
  strokeWidth?: number;
};

export type EllipseAnnotation = AnnotationBase & {
  type: "ellipse";
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  filled?: boolean;
  strokeWidth?: number;
};

export type LineAnnotation = AnnotationBase & {
  type: "line" | "arrow";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  strokeWidth: number;
};

export type CalloutAnnotation = AnnotationBase &
  TextStyle & {
    type: "callout";
    x: number;
    y: number;
    width: number;
    height: number;
    pointerX: number;
    pointerY: number;
    text: string;
    fontSize: number;
    color: string;
  };

export type ImageFilters = {
  brightness?: number; // 1 = unchanged
  contrast?: number; // 1 = unchanged
  grayscale?: number; // 0-1
  sepia?: number; // 0-1
};

export type ImageCrop = { x: number; y: number; width: number; height: number };

export type ImageAnnotation = AnnotationBase & {
  type: "image";
  x: number;
  y: number;
  width: number;
  height: number;
  dataUrl: string;
  rotation?: number;
  opacity?: number;
  filters?: ImageFilters;
  maskShape?: "none" | "ellipse" | "rounded";
  /** Fractions (0-1) of the source image to keep; undefined = whole image. Applied non-destructively — baked into the raster only at export time. */
  crop?: ImageCrop;
};

export type StampPresetId =
  | "approved"
  | "draft"
  | "confidential"
  | "final"
  | "for-review"
  | "void"
  | "completed"
  | "urgent";

export type StampAnnotation = AnnotationBase & {
  type: "stamp";
  x: number;
  y: number;
  width: number;
  height: number;
  dataUrl?: string;
  presetId?: StampPresetId;
  label?: string;
  color?: string;
};

export type MeasurementUnit = "pt" | "in" | "cm" | "mm";

export type MeasurementAnnotation = AnnotationBase & {
  type: "measurement";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  unit: MeasurementUnit;
};

export type NoteAnnotation = AnnotationBase & {
  type: "note";
  x: number;
  y: number;
  text: string;
  color: string;
  direction?: "ltr" | "rtl";
};

export type FormFieldAnnotation = AnnotationBase & {
  type: "form-field";
  fieldName: string;
  fieldKind: "text" | "checkbox" | "radio" | "select";
  x: number;
  y: number;
  width: number;
  height: number;
  value: string;
};

export type FormFieldCreateKind = "text" | "checkbox" | "radio" | "dropdown" | "date";

export type FormFieldConditional = {
  triggerField: string;
  equalsValue: string;
  action: "show" | "hide";
};

export type FormFieldCalculation = {
  op: "SUM" | "PRODUCT" | "AVERAGE" | "MIN" | "MAX";
  sourceFields: string[];
};

/** A new form field to be created in the exported PDF (via pdf-lib's real AcroForm API). */
export type FormFieldCreateAnnotation = AnnotationBase & {
  type: "form-field-create";
  fieldKind: FormFieldCreateKind;
  fieldName: string;
  x: number;
  y: number;
  width: number;
  height: number;
  defaultValue?: string;
  required?: boolean;
  options?: string[];
  calculation?: FormFieldCalculation;
  validateMin?: number;
  validateMax?: number;
  conditional?: FormFieldConditional;
};

export type RedactAnnotation = AnnotationBase & {
  type: "redact";
  x: number;
  y: number;
  width: number;
  height: number;
};

export type LinkTarget = { kind: "url"; url: string } | { kind: "page"; pageId: string };

export type LinkAnnotation = AnnotationBase & {
  type: "link";
  x: number;
  y: number;
  width: number;
  height: number;
  target: LinkTarget;
};

/**
 * Replaces a specific run of existing PDF text in place: at export, a patch is drawn over
 * (x, y, width, height) and `newText` is drawn on top, wrapped to `width`.
 *
 * The appearance fields are optional because documents saved before they existed must still
 * load; each falls back to the original hardcoded behavior when absent.
 */
export type TextEditAnnotation = AnnotationBase & {
  type: "text-edit";
  x: number;
  y: number;
  width: number;
  height: number;
  originalText: string;
  newText: string;
  fontSize: number;
  color: string;
  /** Patch color sampled from behind the original run. Defaults to white. */
  backgroundColor?: string;
  fontFamily?: FontFamily;
  bold?: boolean;
  italic?: boolean;
};

export type Annotation =
  | HighlightAnnotation
  | MarkupAnnotation
  | InkAnnotation
  | TextAnnotation
  | RectAnnotation
  | EllipseAnnotation
  | LineAnnotation
  | CalloutAnnotation
  | ImageAnnotation
  | StampAnnotation
  | MeasurementAnnotation
  | NoteAnnotation
  | FormFieldAnnotation
  | FormFieldCreateAnnotation
  | RedactAnnotation
  | LinkAnnotation
  | TextEditAnnotation;

export type Tool =
  | "select"
  | "highlight"
  | "underline"
  | "strikeout"
  | "squiggly"
  | "ink"
  | "text"
  | "edit-text"
  | "callout"
  | "whiteout"
  | "rect"
  | "ellipse"
  | "line"
  | "arrow"
  | "image"
  | "stamp"
  | "measurement"
  | "note"
  | "redact"
  | "link"
  | "form-text"
  | "form-checkbox"
  | "form-radio"
  | "form-dropdown"
  | "form-date";

export type OcrWord = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type DocPage = {
  id: string;
  sourceId: string;
  sourcePageIndex: number;
  rotation: number;
  annotations: Annotation[];
  ocrWords?: OcrWord[];
};

export type DocSource = {
  id: string;
  name: string;
  bytes: ArrayBuffer | Uint8Array;
};

export type BookmarkNode = {
  id: string;
  title: string;
  pageId: string;
  children: BookmarkNode[];
};

export type ViewMode = "continuous" | "single" | "facing" | "cover";

export function createId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function pagesFromSource(sourceId: string, pageCount: number): DocPage[] {
  return Array.from({ length: pageCount }, (_, i) => ({
    id: createId(),
    sourceId,
    sourcePageIndex: i,
    rotation: 0,
    annotations: [],
  }));
}
