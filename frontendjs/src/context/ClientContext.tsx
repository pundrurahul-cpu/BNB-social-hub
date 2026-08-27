import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

export interface Client {
  id: string;
  name: string;
  logo: string;
  theme: string;
}

interface ClientContextType {
  clients: Client[];
  activeClient: Client | null;
  setActiveClient: (client: Client) => void;
  loading: boolean;
  refreshClients: () => Promise<void>;
}

const ClientContext = createContext<ClientContextType | undefined>(undefined);

export function ClientProvider({ children }: { children: ReactNode }) {
  const [clients, setClients] = useState<Client[]>([]);
  const [activeClient, setActiveClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchClients = async () => {
    console.log('📦 [Clients] Fetching clients from API...');
    try {
      setLoading(true);
      const response = await fetch('http://backendjs.test/api/clients');
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          console.log('✅ [Clients] API loaded successfully:', data.length, 'clients');
          setClients(data);
          setActiveClient(prev => {
            if (prev && data.find((c: any) => c.id === prev.id)) return prev;
            return data[0];
          });
        }
      }
    } catch (error: any) {
      console.error('❌ [Clients] Connection failed:', error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleSetActiveClient = (client: Client) => {
    setActiveClient(client);
  };

  return (
    <ClientContext.Provider value={{
      clients,
      activeClient,
      setActiveClient: handleSetActiveClient,
      loading,
      refreshClients: fetchClients
    }}>
      {children}
    </ClientContext.Provider>
  );
}

export function useClient() {
  const context = useContext(ClientContext);
  if (!context) {
    throw new Error('useClient must be used within a ClientProvider');
  }
  return context;
}
