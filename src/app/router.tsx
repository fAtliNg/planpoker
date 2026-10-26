import { createBrowserRouter } from 'react-router-dom'
import Layout from '../components/Layout'
import HomePage from '../pages/HomePage'
import RoomPage from '../pages/RoomPage'
import NotFoundPage from '../pages/NotFoundPage'

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'r/:roomId', element: <RoomPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
