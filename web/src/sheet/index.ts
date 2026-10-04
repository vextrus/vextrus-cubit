/*
 * The sheet viewer (ticket 16; m0-screens 4.6): a sheet's render buffers (engine/render/buffers.py)
 * decoded, drawn by WebGL on Paper as the engine raster draws them, and viewed: fitted, zoomed, panned.
 *
 *   const sheet = decodeSheet(buffer)                         // or throws SheetBufferError
 *   drawSheet(ctx, sheet, { scale: 4, x: 0, y: ctx.canvas.height })   // 4 px/mm, the paper's corner at the foot
 *   <SheetViewer buffer={buffer} label="S-04" />              // fills its parent; Step 1's canvas (22)
 *   <SheetViewer … dark layer="plot" plot={{ picture: await drawPlotPage(pdf, 18), transform }} />
 */
export { decodeSheet, SheetBufferError, type DecodedSheet, type Paper } from './decode'
export { drawSheet, SheetRenderer } from './gl'
export { type ViewTransform, type PaperBox } from './view'
export { SheetViewer, type SheetOutline, type SheetLayer, type SheetPlot } from './SheetViewer'
export { LookSwitches } from './LookSwitches'
export { drawPlotPage, plotMatrix, readPlotTransform, type PlotPicture, type PlotTransform } from './plot'
