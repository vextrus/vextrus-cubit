/*
 * Takeoff Steps 3, 4 and 6 (S16-W1): the screens at `/p/:code/takeoff/3`, `/4` and `/6`, on session 16's
 * takeoff endpoints (`GET steps/{step}/proposals`, `GET storeys`, `PUT storeys/levels`,
 * `PUT view-placements/{view_id}`, `POST confirmations`).
 *
 *   <StoreysPage />   Step 3, Levels: storeys low to high, typed levels, the views' storeys
 *   <GridPage />      Step 4, Grid: the grid lines by label
 *   <ColumnsPage />   Step 6, Columns: by band and mark, the size answer
 */
export { StoreysPage } from './StoreysStep'
export { ColumnsPage, GridPage } from './GroupedStep'
