import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Products from './pages/Products';
import Categories from './pages/Categories';
import Sales from './pages/Sales';
import SalesHistory from './pages/SalesHistory';
import Inventory from './pages/Inventory';
import Reports from './pages/Reports';
import UserDebug from './pages/UserDebug';
import RoleBasedRoute from './components/RoleBasedRoute';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useSelector((state) => state.auth);
  return isAuthenticated ? children : <Navigate to="/login" />;
};

function App() {
  const { isAuthenticated } = useSelector((state) => state.auth);

  return (
    <Router>
      <Routes>
        <Route 
          path="/login" 
          element={isAuthenticated ? <Navigate to="/dashboard" /> : <Login />} 
        />
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/sales" 
          element={
            <ProtectedRoute>
              <Sales />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/sales-history" 
          element={
            <ProtectedRoute>
              <SalesHistory />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/users" 
          element={
            <RoleBasedRoute allowedRoles={['admin']}>
              <Users />
            </RoleBasedRoute>
          } 
        />
        <Route 
          path="/products" 
          element={
            <RoleBasedRoute allowedRoles={['admin', 'manager']}>
              <Products />
            </RoleBasedRoute>
          } 
        />
        <Route 
          path="/categories" 
          element={
            <RoleBasedRoute allowedRoles={['admin', 'manager']}>
              <Categories />
            </RoleBasedRoute>
          } 
        />
        <Route 
          path="/inventory" 
          element={
            <RoleBasedRoute allowedRoles={['admin', 'manager']}>
              <Inventory />
            </RoleBasedRoute>
          } 
        />
        <Route 
          path="/reports" 
          element={
            <RoleBasedRoute allowedRoles={['admin', 'manager']}>
              <Reports />
            </RoleBasedRoute>
          } 
        />
        <Route path="/" element={<Navigate to="/dashboard" />} />
      </Routes>
    </Router>
  );
}

export default App;