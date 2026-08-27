import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { PostsProvider } from './context/PostsContext';
import { ClientProvider } from './context/ClientContext';
import { UserProvider } from './context/UserContext';
import { NotificationProvider } from './context/NotificationContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <UserProvider>
      <ClientProvider>
        <PostsProvider>
          <NotificationProvider>
            <App />
          </NotificationProvider>
        </PostsProvider>
      </ClientProvider>
    </UserProvider>
  </StrictMode>,
);
