import { Component, type ReactNode } from 'react'

/**
 * Shows `fallback` if anything in a 3D scene throws (e.g. the WebGL context
 * can't be created or a chunk fails to download), so the screen never breaks.
 * Used by the Home hero and the menu hourglass.
 */
export class Hero3DBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.warn('[3d] scene fell back to 2D:', error)
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
