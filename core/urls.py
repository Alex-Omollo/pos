from django.urls import path
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from .views import (
    CustomTokenObtainPairView,
    RegisterView,
    UserListView,
    UserDetailView,
    CurrentUserView,
    ChangePasswordView,
    RoleListView,
    logout_view,
    # Product views
    CategoryListCreateView,
    CategoryDetailView,
    ProductListView,
    ProductCreateView,
    ProductDetailView,
    ProductSearchView,
    LowStockProductsView,
    BulkProductUploadView,
    product_stats_view,
    # Sales views
    SaleListView,
    SaleCreateView,
    SaleDetailView,
    sales_stats_view,
    top_selling_products_view,
    cancel_sale_view,
    # Inventory views
    SupplierListCreateView,
    SupplierDetailView,
    StockMovementListView,
    StockAdjustmentView,
    PurchaseOrderListView,
    PurchaseOrderCreateView,
    PurchaseOrderDetailView,
    receive_purchase_order,
    cancel_purchase_order,
    StockAlertListView,
    inventory_stats_view,
    # Reports views
    sales_report_view,
    product_performance_report_view,
    cashier_performance_report_view,
    inventory_report_view,
    dashboard_stats_view,
    export_sales_report_csv,
)

urlpatterns = [
    # Authentication
    path('auth/login/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/logout/', logout_view, name='logout'),
    path('auth/change-password/', ChangePasswordView.as_view(), name='change_password'),
    
    # User Management
    path('users/', UserListView.as_view(), name='user_list'),
    path('users/register/', RegisterView.as_view(), name='register'),
    path('users/me/', CurrentUserView.as_view(), name='current_user'),
    path('users/<int:pk>/', UserDetailView.as_view(), name='user_detail'),
    
    # Roles
    path('roles/', RoleListView.as_view(), name='role_list'),
    
    # Categories
    path('categories/', CategoryListCreateView.as_view(), name='category_list_create'),
    path('categories/<int:pk>/', CategoryDetailView.as_view(), name='category_detail'),
    
    # Products
    path('products/', ProductListView.as_view(), name='product_list'),
    path('products/create/', ProductCreateView.as_view(), name='product_create'),
    path('products/search/', ProductSearchView.as_view(), name='product_search'),
    path('products/low-stock/', LowStockProductsView.as_view(), name='low_stock_products'),
    path('products/bulk-upload/', BulkProductUploadView.as_view(), name='bulk_upload'),
    path('products/stats/', product_stats_view, name='product_stats'),
    path('products/<int:pk>/', ProductDetailView.as_view(), name='product_detail'),
    
    # Sales
    path('sales/', SaleListView.as_view(), name='sale_list'),
    path('sales/create/', SaleCreateView.as_view(), name='sale_create'),
    path('sales/stats/', sales_stats_view, name='sales_stats'),
    path('sales/top-products/', top_selling_products_view, name='top_products'),
    path('sales/<int:pk>/', SaleDetailView.as_view(), name='sale_detail'),
    path('sales/<int:pk>/cancel/', cancel_sale_view, name='cancel_sale'),
    
    # Inventory - Suppliers
    path('inventory/suppliers/', SupplierListCreateView.as_view(), name='supplier_list_create'),
    path('inventory/suppliers/<int:pk>/', SupplierDetailView.as_view(), name='supplier_detail'),
    
    # Inventory - Stock Movements
    path('inventory/stock-movements/', StockMovementListView.as_view(), name='stock_movement_list'),
    path('inventory/stock-adjustment/', StockAdjustmentView.as_view(), name='stock_adjustment'),
    
    # Inventory - Purchase Orders
    path('inventory/purchase-orders/', PurchaseOrderListView.as_view(), name='purchase_order_list'),
    path('inventory/purchase-orders/create/', PurchaseOrderCreateView.as_view(), name='purchase_order_create'),
    path('inventory/purchase-orders/<int:pk>/', PurchaseOrderDetailView.as_view(), name='purchase_order_detail'),
    path('inventory/purchase-orders/<int:pk>/receive/', receive_purchase_order, name='receive_purchase_order'),
    path('inventory/purchase-orders/<int:pk>/cancel/', cancel_purchase_order, name='cancel_purchase_order'),
    
    # Inventory - Alerts & Stats
    path('inventory/alerts/', StockAlertListView.as_view(), name='stock_alert_list'),
    path('inventory/stats/', inventory_stats_view, name='inventory_stats'),
    
    # Reports
    path('reports/sales/', sales_report_view, name='sales_report'),
    path('reports/products/', product_performance_report_view, name='product_performance'),
    path('reports/cashiers/', cashier_performance_report_view, name='cashier_performance'),
    path('reports/inventory/', inventory_report_view, name='inventory_report'),
    path('reports/dashboard/', dashboard_stats_view, name='dashboard_stats'),
    path('reports/export/sales/', export_sales_report_csv, name='export_sales_csv'),
]