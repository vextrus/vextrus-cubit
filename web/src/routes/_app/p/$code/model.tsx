/*
 * /p/:code/model: the Live Model in 3D, in the frame (session-16 contract, W2).
 */
import { createFileRoute } from '@tanstack/react-router'
import { ModelPage } from '@/model'

export const Route = createFileRoute('/_app/p/$code/model')({
  component: ModelPage,
})
