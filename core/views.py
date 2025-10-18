from rest_framework import status, generics, permissions, filters
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.http import HttpResponse
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import update_session_auth_hash
from django.db import transaction
from django.db.models import Q, Sum, Count, Avg, F
from django.db.models.functions import TruncDate, TruncMonth, TruncWeek
from django.utils import timezone
from .models import (
    User, Role, Product, Category,
    Sale, SaleItem, Payment, Supplier,
    StockMovement, PurchaseOrder, PurchaseOrderItem,
    StockAlert,
)
from .serializers import (
    UserSerializer, UserCreateSerializer, UserUpdateSerializer,
    ChangePasswordSerializer, RoleSerializer,
    ProductListSerializer, ProductDetailSerializer,
    ProductCreateUpdateSerializer, CategorySerializer,
    BulkProductUploadSerializer, SaleListSerializer,
    SaleDetailSerializer, SaleCreateSerializer,
    SupplierSerializer, StockMovementSerializer, StockAdjustmentSerializer,
    PurchaseOrderCreateSerializer, PurchaseOrderDetailSerializer,
    PurchaseOrderListSerializer, StockAlertSerializer
)
from .permissions import IsAdmin, IsManager, IsCashier
import io
import uuid
import csv
from datetime import datetime, timedelta
from decimal import Decimal
from .utils import generate_barcode_number, generate_sku



class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Custom JWT serializer to include user data"""
    
    def validate(self, attrs):
        # Call parent validate to get default token data
        data = super().validate(attrs)
        
        # Add custom user data to the response
        data['user'] = {
            'id': self.user.id,
            'username': self.user.username,
            'email': self.user.email,
            'first_name': self.user.first_name,
            'last_name': self.user.last_name,
            'role': self.user.role.name if self.user.role else None,
            'role_display': self.user.role.get_name_display() if self.user.role else None,
        }
        
        return data

class CustomTokenObtainPairView(TokenObtainPairView):
    """Custom login view with user data"""
    serializer_class = CustomTokenObtainPairSerializer


class RegisterView(generics.CreateAPIView):
    """User registration endpoint (Admin only)"""
    queryset = User.objects.all()
    serializer_class = UserCreateSerializer
    permission_classes = [IsAdmin]


class UserListView(generics.ListAPIView):
    """List all users (Admin and Manager)"""
    queryset = User.objects.all().select_related('role')
    serializer_class = UserSerializer
    permission_classes = [IsManager]


class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    """User detail, update, delete (Admin only for modifications)"""
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return UserUpdateSerializer
        return UserSerializer
    
    def get_permissions(self):
        if self.request.method in ['PUT', 'PATCH', 'DELETE']:
            return [IsAdmin()]
        return [permissions.IsAuthenticated()]


class CurrentUserView(APIView):
    """Get current authenticated user"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)


class ChangePasswordView(APIView):
    """Change user password"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        
        if serializer.is_valid():
            user = request.user
            
            # Check old password
            if not user.check_password(serializer.validated_data['old_password']):
                return Response(
                    {'old_password': 'Wrong password.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Set new password
            user.set_password(serializer.validated_data['new_password'])
            user.save()
            
            # Update session
            update_session_auth_hash(request, user)
            
            return Response(
                {'message': 'Password changed successfully.'},
                status=status.HTTP_200_OK
            )
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class RoleListView(generics.ListAPIView):
    """List all roles"""
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [IsAdmin]


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def logout_view(request):
    """Logout endpoint"""
    return Response(
        {'message': 'Logged out successfully.'},
        status=status.HTTP_200_OK
    )
    

##
class CategoryListCreateView(generics.ListCreateAPIView):
    """List all categories or create new one (Admin/Manager can create)"""
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    
    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsManager()]
        return [IsCashier()]


class CategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update or delete a category (Admin/Manager only for modifications)"""
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    
    def get_permissions(self):
        if self.request.method in ['PUT', 'PATCH', 'DELETE']:
            return [IsManager()]
        return [IsCashier()]


class ProductListView(generics.ListAPIView):
    """List all products with search and filters"""
    serializer_class = ProductListSerializer
    permission_classes = [IsCashier]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'sku', 'barcode', 'category__name']
    ordering_fields = ['name', 'price', 'stock_quantity', 'created_at']
    ordering = ['-created_at']
    
    def get_queryset(self):
        queryset = Product.objects.select_related('category').all()
        
        # Filter by active status
        is_active = self.request.query_params.get('is_active', None)
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        
        # Filter by category
        category = self.request.query_params.get('category', None)
        if category:
            queryset = queryset.filter(category_id=category)
        
        # Filter by low stock
        low_stock = self.request.query_params.get('low_stock', None)
        if low_stock and low_stock.lower() == 'true':
            queryset = queryset.filter(stock_quantity__lte=models.F('min_stock_level'))
        
        return queryset

class ProductCreateView(generics.CreateAPIView):
    """Create new product (Admin/Manager only)"""
    queryset = Product.objects.all()
    serializer_class = ProductCreateUpdateSerializer
    permission_classes = [IsManager]
    
    def perform_create(self, serializer):
        name = serializer.validated_data.get('name', '')
        sku_value = serializer.validated_data.get('sku') or generate_sku(name)
        barcode_value = serializer.validated_data.get('barcode') or generate_barcode_number()

        serializer.save(
            created_by=self.request.user,
            sku=sku_value,
            barcode=barcode_value
        )
class ProductDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Retrieve, update or delete a product"""
    queryset = Product.objects.select_related('category', 'created_by').all()
    permission_classes = [IsCashier]
    
    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return ProductCreateUpdateSerializer
        return ProductDetailSerializer
    
    def get_permissions(self):
        if self.request.method in ['PUT', 'PATCH', 'DELETE']:
            return [IsManager()]
        return [IsCashier()]


class ProductSearchView(APIView):
    """Search products by name, SKU, or barcode"""
    permission_classes = [IsCashier]
    
    def get(self, request):
        query = request.query_params.get('q', '')
        
        if not query:
            return Response({'results': []})
        
        products = Product.objects.filter(
            Q(name__icontains=query) |
            Q(sku__icontains=query) |
            Q(barcode__icontains=query),
            is_active=True
        ).select_related('category')[:20]  # Limit to 20 results
        
        serializer = ProductListSerializer(products, many=True)
        return Response({'results': serializer.data})


class LowStockProductsView(generics.ListAPIView):
    """List products with low stock"""
    serializer_class = ProductListSerializer
    permission_classes = [IsManager]
    
    def get_queryset(self):
        from django.db.models import F
        return Product.objects.filter(
            stock_quantity__lte=F('min_stock_level'),
            is_active=True
        ).select_related('category')


class BulkProductUploadView(APIView):
    """Bulk upload products via CSV (Admin/Manager only)"""
    permission_classes = [IsManager]
    
    def post(self, request):
        serializer = BulkProductUploadSerializer(data=request.data)
        
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        csv_file = serializer.validated_data['csv_file']
        
        try:
            # Read CSV file
            decoded_file = csv_file.read().decode('utf-8')
            io_string = io.StringIO(decoded_file)
            reader = csv.DictReader(io_string)
            
            created_count = 0
            errors = []
            
            for row_num, row in enumerate(reader, start=2):
                try:
                    # Get or create category
                    category = None
                    if row.get('category'):
                        category, _ = Category.objects.get_or_create(
                            name=row['category']
                        )
                    
                    # Create product
                    Product.objects.create(
                        name=row['name'],
                        sku=row['sku'],
                        barcode=row.get('barcode') or None,
                        category=category,
                        description=row.get('description', ''),
                        price=float(row['price']),
                        cost_price=float(row.get('cost_price', 0)),
                        tax_rate=float(row.get('tax_rate', 0)),
                        stock_quantity=int(row.get('stock_quantity', 0)),
                        min_stock_level=int(row.get('min_stock_level', 10)),
                        created_by=request.user
                    )
                    created_count += 1
                    
                except Exception as e:
                    errors.append(f"Row {row_num}: {str(e)}")
            
            return Response({
                'message': f'Successfully created {created_count} products',
                'created_count': created_count,
                'errors': errors
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response(
                {'error': f'Error processing CSV file: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )


@api_view(['GET'])
@permission_classes([IsManager])
def product_stats_view(request):
    """Get product statistics"""
    from django.db.models import Sum, Count, Avg, F
    
    stats = {
        'total_products': Product.objects.filter(is_active=True).count(),
        'total_categories': Category.objects.filter(is_active=True).count(),
        'low_stock_products': Product.objects.filter(
            stock_quantity__lte=F('min_stock_level'),
            is_active=True
        ).count(),
        'out_of_stock_products': Product.objects.filter(
            stock_quantity=0,
            is_active=True
        ).count(),
        'total_stock_value': Product.objects.filter(is_active=True).aggregate(
            total=Sum(F('stock_quantity') * F('cost_price'))
        )['total'] or 0,
    }
    
    return Response(stats)

##
class SaleListView(generics.ListAPIView):
    """List all sales with filters"""
    serializer_class = SaleListSerializer
    permission_classes = [IsCashier]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['invoice_number', 'customer_name', 'cashier__username']
    ordering_fields = ['created_at', 'total']
    ordering = ['-created_at']
    
    def get_queryset(self):
        queryset = Sale.objects.select_related('cashier').all()
        
        # Filter by date range
        start_date = self.request.query_params.get('start_date', None)
        end_date = self.request.query_params.get('end_date', None)
        
        if start_date:
            queryset = queryset.filter(created_at__gte=start_date)
        if end_date:
            # Add one day to include the end date
            end_datetime = datetime.strptime(end_date, '%Y-%m-%d') + timedelta(days=1)
            queryset = queryset.filter(created_at__lt=end_datetime)
        
        # Filter by cashier
        cashier_id = self.request.query_params.get('cashier', None)
        if cashier_id:
            queryset = queryset.filter(cashier_id=cashier_id)
        
        # Filter by payment method
        payment_method = self.request.query_params.get('payment_method', None)
        if payment_method:
            queryset = queryset.filter(payment_method=payment_method)
        
        # Filter by status
        sale_status = self.request.query_params.get('status', None)
        if sale_status:
            queryset = queryset.filter(status=sale_status)
        
        # If cashier role, only show their own sales
        user = self.request.user
        if user.is_cashier and not (user.is_admin or user.is_manager):
            queryset = queryset.filter(cashier=user)
        
        return queryset


class SaleCreateView(generics.CreateAPIView):
    """Create a new sale"""
    serializer_class = SaleCreateSerializer
    permission_classes = [IsCashier]
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        sale = serializer.save()
        
        # Return detailed sale data
        detail_serializer = SaleDetailSerializer(sale)
        return Response(detail_serializer.data, status=status.HTTP_201_CREATED)


class SaleDetailView(generics.RetrieveAPIView):
    """Get sale details"""
    queryset = Sale.objects.select_related('cashier').prefetch_related('items', 'payments').all()
    serializer_class = SaleDetailSerializer
    permission_classes = [IsCashier]
    
    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        
        # If cashier, only show their own sales
        if user.is_cashier and not (user.is_admin or user.is_manager):
            queryset = queryset.filter(cashier=user)
        
        return queryset


@api_view(['GET'])
@permission_classes([IsCashier])
def sales_stats_view(request):
    """Get sales statistics"""
    from django.db.models import Sum, Count, Avg
    
    # Date filters
    start_date = request.query_params.get('start_date', None)
    end_date = request.query_params.get('end_date', None)
    
    queryset = Sale.objects.filter(status='completed')
    
    if start_date:
        queryset = queryset.filter(created_at__gte=start_date)
    if end_date:
        end_datetime = datetime.strptime(end_date, '%Y-%m-%d') + timedelta(days=1)
        queryset = queryset.filter(created_at__lt=end_datetime)
    
    # If cashier, only their sales
    user = request.user
    if user.is_cashier and not (user.is_admin or user.is_manager):
        queryset = queryset.filter(cashier=user)
    
    stats = queryset.aggregate(
        total_sales=Count('id'),
        total_revenue=Sum('total'),
        average_sale=Avg('total'),
        total_items_sold=Sum('items__quantity')
    )
    
    # Payment method breakdown
    payment_breakdown = queryset.values('payment_method').annotate(
        count=Count('id'),
        total=Sum('total')
    )
    
    stats['payment_breakdown'] = list(payment_breakdown)
    
    return Response(stats)


@api_view(['GET'])
@permission_classes([IsManager])
def top_selling_products_view(request):
    """Get top selling products"""
    from django.db.models import Sum, Count
    
    # Date filters
    days = int(request.query_params.get('days', 30))
    start_date = datetime.now() - timedelta(days=days)
    
    top_products = SaleItem.objects.filter(
        sale__created_at__gte=start_date,
        sale__status='completed'
    ).values(
        'product__id',
        'product__name',
        'product__sku'
    ).annotate(
        total_quantity=Sum('quantity'),
        total_revenue=Sum('subtotal'),
        times_sold=Count('id')
    ).order_by('-total_quantity')[:10]
    
    return Response(list(top_products))


@api_view(['POST'])
@permission_classes([IsManager])
def cancel_sale_view(request, pk):
    """Cancel a sale (Admin/Manager only)"""
    from django.db import transaction
    
    try:
        sale = Sale.objects.get(pk=pk)
    except Sale.DoesNotExist:
        return Response(
            {'error': 'Sale not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    if sale.status == 'cancelled':
        return Response(
            {'error': 'Sale is already cancelled'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    with transaction.atomic():
        # Restore stock
        for item in sale.items.all():
            product = item.product
            product.stock_quantity += item.quantity
            product.save()
        
        # Update sale status
        sale.status = 'cancelled'
        sale.save()
    
    return Response({
        'message': 'Sale cancelled successfully',
        'sale': SaleDetailSerializer(sale).data
    })
    
##
class SupplierListCreateView(generics.ListCreateAPIView):
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer
    permission_classes = [IsManager]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'contact_person', 'email']
    ordering = ['name']


class SupplierDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer
    permission_classes = [IsManager]


# Stock Movement Views
class StockMovementListView(generics.ListAPIView):
    serializer_class = StockMovementSerializer
    permission_classes = [IsManager]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['product__name', 'product__sku', 'reference_number']
    ordering = ['-created_at']
    
    def get_queryset(self):
        queryset = StockMovement.objects.select_related(
            'product', 'supplier', 'user'
        ).all()
        
        # Filter by product
        product_id = self.request.query_params.get('product', None)
        if product_id:
            queryset = queryset.filter(product_id=product_id)
        
        # Filter by movement type
        movement_type = self.request.query_params.get('movement_type', None)
        if movement_type:
            queryset = queryset.filter(movement_type=movement_type)
        
        return queryset


class StockAdjustmentView(APIView):
    """Manual stock adjustment"""
    permission_classes = [IsManager]
    
    def post(self, request):
        serializer = StockAdjustmentSerializer(data=request.data)
        
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        validated_data = serializer.validated_data
        product = validated_data['_product']
        adjustment_type = validated_data['adjustment_type']
        quantity = validated_data['quantity']
        
        with transaction.atomic():
            previous_quantity = product.stock_quantity
            
            # Calculate new quantity
            if adjustment_type == 'add':
                new_quantity = previous_quantity + quantity
                movement_quantity = quantity
            elif adjustment_type == 'remove':
                new_quantity = previous_quantity - quantity
                movement_quantity = -quantity
            else:  # set
                new_quantity = quantity
                movement_quantity = quantity - previous_quantity
            
            # Update product stock
            product.stock_quantity = new_quantity
            product.save()
            
            # Create stock movement record
            movement = StockMovement.objects.create(
                product=product,
                movement_type='adjustment',
                quantity=movement_quantity,
                previous_quantity=previous_quantity,
                new_quantity=new_quantity,
                reference_number=validated_data.get('reference_number', ''),
                user=request.user,
                notes=validated_data['reason']
            )
            
            # Check for low stock alert
            if new_quantity <= product.min_stock_level:
                StockAlert.objects.get_or_create(
                    product=product,
                    is_resolved=False,
                    defaults={
                        'alert_level': product.min_stock_level,
                        'current_stock': new_quantity
                    }
                )
        
        return Response({
            'message': 'Stock adjusted successfully',
            'movement': StockMovementSerializer(movement).data
        }, status=status.HTTP_200_OK)


# Purchase Order Views
class PurchaseOrderListView(generics.ListAPIView):
    serializer_class = PurchaseOrderListSerializer
    permission_classes = [IsManager]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['po_number', 'supplier__name']
    ordering = ['-created_at']
    
    def get_queryset(self):
        queryset = PurchaseOrder.objects.select_related('supplier', 'created_by').all()
        
        # Filter by status
        po_status = self.request.query_params.get('status', None)
        if po_status:
            queryset = queryset.filter(status=po_status)
        
        return queryset


class PurchaseOrderCreateView(generics.CreateAPIView):
    serializer_class = PurchaseOrderCreateSerializer
    permission_classes = [IsManager]
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        po = serializer.save()
        
        detail_serializer = PurchaseOrderDetailSerializer(po)
        return Response(detail_serializer.data, status=status.HTTP_201_CREATED)


class PurchaseOrderDetailView(generics.RetrieveAPIView):
    queryset = PurchaseOrder.objects.prefetch_related('items__product').all()
    serializer_class = PurchaseOrderDetailSerializer
    permission_classes = [IsManager]


@api_view(['POST'])
@permission_classes([IsManager])
def receive_purchase_order(request, pk):
    """Mark purchase order as received and update stock"""
    try:
        po = PurchaseOrder.objects.get(pk=pk)
    except PurchaseOrder.DoesNotExist:
        return Response(
            {'error': 'Purchase order not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    if po.status == 'received':
        return Response(
            {'error': 'Purchase order already received'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    with transaction.atomic():
        # Update stock for each item
        for item in po.items.all():
            product = item.product
            previous_quantity = product.stock_quantity
            new_quantity = previous_quantity + item.quantity_ordered
            
            # Update product stock
            product.stock_quantity = new_quantity
            product.save()
            
            # Update item received quantity
            item.quantity_received = item.quantity_ordered
            item.save()
            
            # Create stock movement
            StockMovement.objects.create(
                product=product,
                movement_type='purchase',
                quantity=item.quantity_ordered,
                previous_quantity=previous_quantity,
                new_quantity=new_quantity,
                unit_cost=item.unit_cost,
                reference_number=po.po_number,
                supplier=po.supplier,
                user=request.user,
                notes=f'Received from PO {po.po_number}'
            )
            
            # Resolve low stock alerts if any
            StockAlert.objects.filter(
                product=product,
                is_resolved=False
            ).update(
                is_resolved=True,
                resolved_at=timezone.now()
            )
        
        # Update PO status
        po.status = 'received'
        po.received_date = timezone.now()
        po.save()
    
    return Response({
        'message': 'Purchase order received successfully',
        'po': PurchaseOrderDetailSerializer(po).data
    })


@api_view(['POST'])
@permission_classes([IsManager])
def cancel_purchase_order(request, pk):
    """Cancel a purchase order"""
    try:
        po = PurchaseOrder.objects.get(pk=pk)
    except PurchaseOrder.DoesNotExist:
        return Response(
            {'error': 'Purchase order not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    
    if po.status == 'received':
        return Response(
            {'error': 'Cannot cancel a received purchase order'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    po.status = 'cancelled'
    po.save()
    
    return Response({
        'message': 'Purchase order cancelled successfully',
        'po': PurchaseOrderDetailSerializer(po).data
    })


# Stock Alert Views
class StockAlertListView(generics.ListAPIView):
    serializer_class = StockAlertSerializer
    permission_classes = [IsManager]
    
    def get_queryset(self):
        # Only show unresolved alerts
        return StockAlert.objects.filter(is_resolved=False).select_related('product')


@api_view(['GET'])
@permission_classes([IsManager])
def inventory_stats_view(request):
    """Get inventory statistics"""
    from django.db.models import Sum, Count, F, Q
    
    stats = {
        'total_products': Product.objects.filter(is_active=True).count(),
        'total_stock_value': Product.objects.filter(is_active=True).aggregate(
            total=Sum(F('stock_quantity') * F('cost_price'))
        )['total'] or 0,
        'low_stock_count': Product.objects.filter(
            stock_quantity__lte=F('min_stock_level'),
            is_active=True
        ).count(),
        'out_of_stock_count': Product.objects.filter(
            stock_quantity=0,
            is_active=True
        ).count(),
        'active_alerts': StockAlert.objects.filter(is_resolved=False).count(),
        'pending_pos': PurchaseOrder.objects.filter(status='pending').count(),
    }
    
    return Response(stats)

## 
@api_view(['GET'])
@permission_classes([IsManager])
def sales_report_view(request):
    """Comprehensive sales report with filters"""
    # Get date range from query params
    start_date = request.query_params.get('start_date')
    end_date = request.query_params.get('end_date')
    period = request.query_params.get('period', 'daily')  # daily, weekly, monthly
    cashier_id = request.query_params.get('cashier')
    
    # Base queryset
    queryset = Sale.objects.filter(status='completed')
    
    # Apply filters
    if start_date:
        queryset = queryset.filter(created_at__gte=start_date)
    else:
        # Default to last 30 days
        start_date = (datetime.now() - timedelta(days=30)).date()
        queryset = queryset.filter(created_at__gte=start_date)
    
    if end_date:
        end_datetime = datetime.strptime(end_date, '%Y-%m-%d') + timedelta(days=1)
        queryset = queryset.filter(created_at__lt=end_datetime)
    
    if cashier_id:
        queryset = queryset.filter(cashier_id=cashier_id)
    
    # Aggregate data based on period
    if period == 'daily':
        sales_by_period = queryset.annotate(
            period=TruncDate('created_at')
        ).values('period').annotate(
            total_sales=Count('id'),
            total_revenue=Sum('total'),
            average_sale=Avg('total')
        ).order_by('period')
    elif period == 'weekly':
        sales_by_period = queryset.annotate(
            period=TruncWeek('created_at')
        ).values('period').annotate(
            total_sales=Count('id'),
            total_revenue=Sum('total'),
            average_sale=Avg('total')
        ).order_by('period')
    else:  # monthly
        sales_by_period = queryset.annotate(
            period=TruncMonth('created_at')
        ).values('period').annotate(
            total_sales=Count('id'),
            total_revenue=Sum('total'),
            average_sale=Avg('total')
        ).order_by('period')
    
    # Overall statistics
    overall_stats = queryset.aggregate(
        total_sales=Count('id'),
        total_revenue=Sum('total'),
        average_sale=Avg('total'),
        total_discount=Sum('discount_amount'),
        total_tax=Sum('tax_amount')
    )
    
    # Payment method breakdown
    payment_breakdown = queryset.values('payment_method').annotate(
        count=Count('id'),
        total=Sum('total')
    )
    
    # Top cashiers
    top_cashiers = queryset.values(
        'cashier__id',
        'cashier__username',
        'cashier__first_name',
        'cashier__last_name'
    ).annotate(
        total_sales=Count('id'),
        total_revenue=Sum('total')
    ).order_by('-total_revenue')[:10]
    
    return Response({
        'period': period,
        'date_range': {
            'start': start_date,
            'end': end_date
        },
        'overall_stats': overall_stats,
        'sales_by_period': list(sales_by_period),
        'payment_breakdown': list(payment_breakdown),
        'top_cashiers': list(top_cashiers)
    })


@api_view(['GET'])
@permission_classes([IsManager])
def product_performance_report_view(request):
    """Product performance and profitability report"""
    start_date = request.query_params.get('start_date')
    end_date = request.query_params.get('end_date')
    limit = int(request.query_params.get('limit', 20))
    
    # Base queryset
    queryset = SaleItem.objects.filter(sale__status='completed')
    
    # Apply date filters
    if start_date:
        queryset = queryset.filter(sale__created_at__gte=start_date)
    if end_date:
        end_datetime = datetime.strptime(end_date, '%Y-%m-%d') + timedelta(days=1)
        queryset = queryset.filter(sale__created_at__lt=end_datetime)
    
    # Top selling products by quantity
    top_products_qty = queryset.values(
        'product__id',
        'product__name',
        'product__sku',
        'product__cost_price'
    ).annotate(
        total_quantity=Sum('quantity'),
        total_revenue=Sum('subtotal'),
        times_sold=Count('sale')
    ).order_by('-total_quantity')[:limit]
    
    # Calculate profit for each product
    top_products_list = list(top_products_qty)
    for product in top_products_list:
        cost_price = product['product__cost_price']
        revenue = product['total_revenue']
        quantity = product['total_quantity']
        
        if cost_price and quantity:
            total_cost = cost_price * quantity
            profit = revenue - total_cost
            profit_margin = (profit / revenue * 100) if revenue > 0 else 0
            
            product['total_cost'] = float(total_cost)
            product['profit'] = float(profit)
            product['profit_margin'] = round(float(profit_margin), 2)
        else:
            product['total_cost'] = 0
            product['profit'] = 0
            product['profit_margin'] = 0
    
    # Top products by revenue
    top_products_revenue = queryset.values(
        'product__id',
        'product__name',
        'product__sku'
    ).annotate(
        total_revenue=Sum('subtotal'),
        total_quantity=Sum('quantity')
    ).order_by('-total_revenue')[:limit]
    
    # Low performing products
    low_performing = queryset.values(
        'product__id',
        'product__name',
        'product__sku'
    ).annotate(
        total_quantity=Sum('quantity'),
        total_revenue=Sum('subtotal')
    ).order_by('total_quantity')[:10]
    
    return Response({
        'top_products_by_quantity': top_products_list,
        'top_products_by_revenue': list(top_products_revenue),
        'low_performing_products': list(low_performing)
    })


@api_view(['GET'])
@permission_classes([IsManager])
def cashier_performance_report_view(request):
    """Cashier performance report"""
    start_date = request.query_params.get('start_date')
    end_date = request.query_params.get('end_date')
    
    # Base queryset
    queryset = Sale.objects.filter(status='completed')
    
    # Apply date filters
    if start_date:
        queryset = queryset.filter(created_at__gte=start_date)
    if end_date:
        end_datetime = datetime.strptime(end_date, '%Y-%m-%d') + timedelta(days=1)
        queryset = queryset.filter(created_at__lt=end_datetime)
    
    # Cashier performance
    cashier_stats = queryset.values(
        'cashier__id',
        'cashier__username',
        'cashier__first_name',
        'cashier__last_name'
    ).annotate(
        total_sales=Count('id'),
        total_revenue=Sum('total'),
        average_sale=Avg('total'),
        total_items_sold=Sum('items__quantity'),
        total_discount_given=Sum('discount_amount')
    ).order_by('-total_revenue')
    
    # Sales by payment method per cashier
    cashier_payment_methods = queryset.values(
        'cashier__username',
        'payment_method'
    ).annotate(
        count=Count('id'),
        total=Sum('total')
    )
    
    return Response({
        'cashier_performance': list(cashier_stats),
        'payment_methods_by_cashier': list(cashier_payment_methods)
    })


@api_view(['GET'])
@permission_classes([IsManager])
def inventory_report_view(request):
    """Inventory valuation and status report"""
    from django.db.models import F
    
    # Stock valuation
    products = Product.objects.filter(is_active=True).annotate(
        stock_value=F('stock_quantity') * F('cost_price')
    )
    
    total_stock_value = products.aggregate(
        total=Sum('stock_value')
    )['total'] or 0
    
    # Stock status breakdown
    in_stock = products.filter(stock_quantity__gt=F('min_stock_level')).count()
    low_stock = products.filter(
        stock_quantity__lte=F('min_stock_level'),
        stock_quantity__gt=0
    ).count()
    out_of_stock = products.filter(stock_quantity=0).count()
    
    # Top value inventory items
    top_value_items = products.order_by('-stock_value')[:10].values(
        'id', 'name', 'sku', 'stock_quantity', 'cost_price', 'stock_value'
    )
    
    # Fast moving products (last 30 days)
    thirty_days_ago = datetime.now() - timedelta(days=30)
    fast_moving = SaleItem.objects.filter(
        sale__created_at__gte=thirty_days_ago,
        sale__status='completed'
    ).values(
        'product__id',
        'product__name',
        'product__sku'
    ).annotate(
        total_sold=Sum('quantity')
    ).order_by('-total_sold')[:10]
    
    # Slow moving products
    slow_moving = SaleItem.objects.filter(
        sale__created_at__gte=thirty_days_ago,
        sale__status='completed'
    ).values(
        'product__id',
        'product__name',
        'product__sku'
    ).annotate(
        total_sold=Sum('quantity')
    ).order_by('total_sold')[:10]
    
    return Response({
        'total_stock_value': float(total_stock_value),
        'stock_status': {
            'in_stock': in_stock,
            'low_stock': low_stock,
            'out_of_stock': out_of_stock
        },
        'top_value_items': list(top_value_items),
        'fast_moving_products': list(fast_moving),
        'slow_moving_products': list(slow_moving)
    })


@api_view(['GET'])
@permission_classes([IsManager])
def dashboard_stats_view(request):
    """Dashboard overview statistics"""
    # Get date range (default last 30 days)
    thirty_days_ago = datetime.now() - timedelta(days=30)
    seven_days_ago = datetime.now() - timedelta(days=7)
    today = datetime.now().date()
    
    # Sales statistics
    total_sales = Sale.objects.filter(status='completed').count()
    sales_today = Sale.objects.filter(
        status='completed',
        created_at__date=today
    ).aggregate(
        count=Count('id'),
        revenue=Sum('total')
    )
    
    sales_this_week = Sale.objects.filter(
        status='completed',
        created_at__gte=seven_days_ago
    ).aggregate(
        count=Count('id'),
        revenue=Sum('total')
    )
    
    sales_this_month = Sale.objects.filter(
        status='completed',
        created_at__gte=thirty_days_ago
    ).aggregate(
        count=Count('id'),
        revenue=Sum('total')
    )
    
    # Product statistics
    total_products = Product.objects.filter(is_active=True).count()
    low_stock_count = Product.objects.filter(
        stock_quantity__lte=F('min_stock_level'),
        is_active=True
    ).count()
    
    # Recent sales trend (last 7 days)
    sales_trend = Sale.objects.filter(
        status='completed',
        created_at__gte=seven_days_ago
    ).annotate(
        date=TruncDate('created_at')
    ).values('date').annotate(
        count=Count('id'),
        revenue=Sum('total')
    ).order_by('date')
    
    return Response({
        'total_sales': total_sales,
        'today': {
            'sales': sales_today['count'] or 0,
            'revenue': float(sales_today['revenue'] or 0)
        },
        'this_week': {
            'sales': sales_this_week['count'] or 0,
            'revenue': float(sales_this_week['revenue'] or 0)
        },
        'this_month': {
            'sales': sales_this_month['count'] or 0,
            'revenue': float(sales_this_month['revenue'] or 0)
        },
        'total_products': total_products,
        'low_stock_alerts': low_stock_count,
        'sales_trend': list(sales_trend)
    })


@api_view(['GET'])
@permission_classes([IsManager])
def export_sales_report_csv(request):
    """Export sales report as CSV"""
    start_date = request.query_params.get('start_date')
    end_date = request.query_params.get('end_date')
    
    queryset = Sale.objects.filter(status='completed').select_related('cashier')
    
    if start_date:
        queryset = queryset.filter(created_at__gte=start_date)
    if end_date:
        end_datetime = datetime.strptime(end_date, '%Y-%m-%d') + timedelta(days=1)
        queryset = queryset.filter(created_at__lt=end_datetime)
    
    # Create CSV response
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = 'attachment; filename="sales_report.csv"'
    
    writer = csv.writer(response)
    writer.writerow([
        'Invoice Number', 'Date', 'Cashier', 'Customer',
        'Subtotal', 'Tax', 'Discount', 'Total', 'Payment Method'
    ])
    
    for sale in queryset:
        writer.writerow([
            sale.invoice_number,
            sale.created_at.strftime('%Y-%m-%d %H:%M'),
            sale.cashier.username,
            sale.customer_name or 'Walk-in',
            sale.subtotal,
            sale.tax_amount,
            sale.discount_amount,
            sale.total,
            sale.get_payment_method_display()
        ])
    
    return response