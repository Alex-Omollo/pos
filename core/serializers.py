from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from decimal import Decimal
from .models import (
    User, Role, Supplier,
    Product, Category, StockMovement,
    Sale, SaleItem, Payment, StockAlert,
    PurchaseOrder, PurchaseOrderItem
)


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ['id', 'name', 'description']


class UserSerializer(serializers.ModelSerializer):
    role_name = serializers.CharField(source='role.name', read_only=True)
    role_display = serializers.CharField(source='role.get_name_display', read_only=True)
    
    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'phone', 'address', 'role', 'role_name', 'role_display',
            'is_active', 'date_joined', 'last_login'
        ]
        read_only_fields = ['id', 'date_joined', 'last_login']


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True, required=True)
    
    class Meta:
        model = User
        fields = [
            'username', 'email', 'password', 'password2',
            'first_name', 'last_name', 'phone', 'address', 'role'
        ]
    
    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({"password": "Password fields didn't match."})
        return attrs
    
    def create(self, validated_data):
        validated_data.pop('password2')
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            'email', 'first_name', 'last_name',
            'phone', 'address', 'role', 'is_active'
        ]


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, validators=[validate_password])
    new_password2 = serializers.CharField(required=True)
    
    def validate(self, attrs):
        if attrs['new_password'] != attrs['new_password2']:
            raise serializers.ValidationError({"new_password": "Password fields didn't match."})
        return attrs
    

##
class CategorySerializer(serializers.ModelSerializer):
    product_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Category
        fields = ['id', 'name', 'description', 'is_active', 'product_count', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']
    
    def get_product_count(self, obj):
        return obj.products.filter(is_active=True).count()


class ProductListSerializer(serializers.ModelSerializer):
    """Serializer for product list view (less detailed)"""
    category_name = serializers.CharField(source='category.name', read_only=True)
    is_low_stock = serializers.BooleanField(read_only=True)
    
    class Meta:
        model = Product
        fields = [
            'id', 'name', 'sku', 'barcode', 'category', 'category_name',
            'price', 'stock_quantity', 'is_low_stock', 'is_active', 'image'
        ]


class ProductDetailSerializer(serializers.ModelSerializer):
    """Serializer for product detail view (more detailed)"""
    category_name = serializers.CharField(source='category.name', read_only=True)
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    is_low_stock = serializers.BooleanField(read_only=True)
    price_with_tax = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    profit_margin = serializers.DecimalField(max_digits=5, decimal_places=2, read_only=True)
    
    class Meta:
        model = Product
        fields = [
            'id', 'name', 'sku', 'barcode', 'category', 'category_name',
            'description', 'price', 'cost_price', 'tax_rate', 'price_with_tax',
            'stock_quantity', 'min_stock_level', 'is_low_stock', 'profit_margin',
            'is_active', 'image', 'created_by', 'created_by_username',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at', 'created_by']


class ProductCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating products"""
    sku = serializers.CharField(required=False, allow_blank=True)
    
    class Meta:
        model = Product
        fields = [
            'name', 'sku', 'barcode', 'category', 'description',
            'price', 'cost_price', 'tax_rate', 'stock_quantity',
            'min_stock_level', 'is_active', 'image'
        ]
    
    def validate_sku(self, value):
        """Ensure SKU is unique"""
        instance = self.instance
        if instance and instance.sku == value:
            return value
        
        if Product.objects.filter(sku=value).exists():
            raise serializers.ValidationError("Product with this SKU already exists.")
        return value
    
    def validate_barcode(self, value):
        """Ensure barcode is unique if provided"""
        if not value:
            return value
        
        instance = self.instance
        if instance and instance.barcode == value:
            return value
        
        if Product.objects.filter(barcode=value).exists():
            raise serializers.ValidationError("Product with this barcode already exists.")
        return value
    
    def validate(self, attrs):
        """Additional validation"""
        if attrs.get('price', 0) < attrs.get('cost_price', 0):
            raise serializers.ValidationError({
                "price": "Selling price cannot be less than cost price."
            })
        return attrs


class BulkProductUploadSerializer(serializers.Serializer):
    """Serializer for bulk product upload via CSV"""
    csv_file = serializers.FileField()
    
    def validate_csv_file(self, value):
        if not value.name.endswith('.csv'):
            raise serializers.ValidationError("Only CSV files are allowed.")
        return value
    
## 
class SaleItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = SaleItem
        fields = [
            'id', 'product', 'product_name', 'product_sku',
            'quantity', 'unit_price', 'tax_rate', 'discount_percent', 'subtotal'
        ]
        read_only_fields = ['id', 'subtotal']


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = ['id', 'payment_method', 'amount', 'reference_number', 'notes']
        read_only_fields = ['id']


class SaleListSerializer(serializers.ModelSerializer):
    """Serializer for sale list view"""
    cashier_name = serializers.CharField(source='cashier.username', read_only=True)
    items_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Sale
        fields = [
            'id', 'invoice_number', 'cashier', 'cashier_name',
            'customer_name', 'total', 'payment_method', 'status',
            'items_count', 'created_at'
        ]
    
    def get_items_count(self, obj):
        return obj.items.count()


class SaleDetailSerializer(serializers.ModelSerializer):
    """Serializer for sale detail view"""
    items = SaleItemSerializer(many=True, read_only=True)
    payments = PaymentSerializer(many=True, read_only=True)
    cashier_name = serializers.CharField(source='cashier.username', read_only=True)
    
    class Meta:
        model = Sale
        fields = [
            'id', 'invoice_number', 'cashier', 'cashier_name',
            'customer_name', 'subtotal', 'tax_amount', 'discount_amount',
            'total', 'payment_method', 'amount_paid', 'change_amount',
            'status', 'notes', 'items', 'payments', 'created_at', 'updated_at'
        ]


class SaleItemCreateSerializer(serializers.Serializer):
    """Serializer for creating sale items"""
    product_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1)
    discount_percent = serializers.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        min_value=0,
        max_value=100
    )


class SaleCreateSerializer(serializers.Serializer):
    """Serializer for creating a sale"""
    customer_name = serializers.CharField(required=False, allow_blank=True)
    items = SaleItemCreateSerializer(many=True)
    payment_method = serializers.ChoiceField(
        choices=['cash', 'card', 'mobile'],
        default='cash'
    )
    amount_paid = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0)
    notes = serializers.CharField(required=False, allow_blank=True)
    
    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError("At least one item is required.")
        return value
    
    def validate(self, attrs):    
    # Calculate totals
        items_data = attrs.get('items', [])
        subtotal = Decimal('0.00')
        tax_amount = Decimal('0.00')
        discount_amount = Decimal('0.00')
        
        for item_data in items_data:
            try:
                product = Product.objects.get(id=item_data['product_id'])
            except Product.DoesNotExist:
                raise serializers.ValidationError(
                    f"Product with id {item_data['product_id']} not found."
                )
            
            # Check stock
            if product.stock_quantity < item_data['quantity']:
                raise serializers.ValidationError(
                    f"Insufficient stock for {product.name}. Available: {product.stock_quantity}"
                )
            
            # Calculate amounts with proper Decimal precision
            quantity = Decimal(str(item_data['quantity']))
            unit_price = Decimal(str(product.price))
            discount_percent = Decimal(str(item_data.get('discount_percent', 0)))
            tax_rate = Decimal(str(product.tax_rate))
            
            # Calculate step by step
            item_subtotal = unit_price * quantity
            item_discount = item_subtotal * (discount_percent / Decimal('100'))
            item_after_discount = item_subtotal - item_discount
            item_tax = item_after_discount * (tax_rate / Decimal('100'))
            
            subtotal += item_subtotal
            discount_amount += item_discount
            tax_amount += item_tax
        
        total = subtotal - discount_amount + tax_amount
        
        # Round to 2 decimal places
        total = total.quantize(Decimal('0.01'))
        
        # Validate payment amount - also use Decimal
        amount_paid = Decimal(str(attrs['amount_paid']))
        
        if amount_paid < total:
            raise serializers.ValidationError(
                f"Amount paid (${amount_paid}) is less than total (${total})."
            )
        
        # Store calculated values
        attrs['_calculated'] = {
            'subtotal': subtotal.quantize(Decimal('0.01')),
            'tax_amount': tax_amount.quantize(Decimal('0.01')),
            'discount_amount': discount_amount.quantize(Decimal('0.01')),
            'total': total,
            'change_amount': (amount_paid - total).quantize(Decimal('0.01'))
        }
    
        return attrs
    
    def create(self, validated_data):
        from django.db import transaction
        
        items_data = validated_data.pop('items')
        calculated = validated_data.pop('_calculated')
        
        with transaction.atomic():
            # Create sale
            sale = Sale.objects.create(
                cashier=self.context['request'].user,
                customer_name=validated_data.get('customer_name', ''),
                subtotal=calculated['subtotal'],
                tax_amount=calculated['tax_amount'],
                discount_amount=calculated['discount_amount'],
                total=calculated['total'],
                payment_method=validated_data['payment_method'],
                amount_paid=validated_data['amount_paid'],
                change_amount=calculated['change_amount'],
                notes=validated_data.get('notes', ''),
                status='completed'
            )
            
            # Create sale items and update stock
            for item_data in items_data:
                product = Product.objects.select_for_update().get(id=item_data['product_id'])
                
                # Create sale item
                SaleItem.objects.create(
                    sale=sale,
                    product=product,
                    product_name=product.name,
                    product_sku=product.sku,
                    quantity=item_data['quantity'],
                    unit_price=product.price,
                    tax_rate=product.tax_rate,
                    discount_percent=item_data.get('discount_percent', 0)
                )
                
                # Update stock
                product.stock_quantity -= item_data['quantity']
                product.save()
                
                ## Check this ##
                StockMovement.objects.create(
                    product=product,
                    movement_type='sale',
                    quantity=-item_data['quantity'],
                    previous_quantity=product.stock_quantity + item_data['quantity'],
                    new_quantity=product.stock_quantity,
                    sale=sale,
                    user=self.context['request'].user
                )
            
            # Create payment record
            Payment.objects.create(
                sale=sale,
                payment_method=validated_data['payment_method'],
                amount=validated_data['amount_paid']
            )
        
        return sale
    
## 
class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = [
            'id', 'name', 'contact_person', 'email', 'phone',
            'address', 'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']


class StockMovementSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_sku = serializers.CharField(source='product.sku', read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    user_name = serializers.CharField(source='user.username', read_only=True)
    movement_type_display = serializers.CharField(source='get_movement_type_display', read_only=True)
    
    class Meta:
        model = StockMovement
        fields = [
            'id', 'product', 'product_name', 'product_sku',
            'movement_type', 'movement_type_display', 'quantity',
            'previous_quantity', 'new_quantity', 'unit_cost',
            'reference_number', 'supplier', 'supplier_name',
            'sale', 'user', 'user_name', 'notes', 'created_at'
        ]
        read_only_fields = ['created_at']


class StockAdjustmentSerializer(serializers.Serializer):
    """Serializer for manual stock adjustments"""
    product_id = serializers.IntegerField()
    adjustment_type = serializers.ChoiceField(choices=['add', 'remove', 'set'])
    quantity = serializers.IntegerField(min_value=0)
    reason = serializers.CharField(max_length=500)
    reference_number = serializers.CharField(max_length=100, required=False, allow_blank=True)
    
    def validate(self, attrs):
        try:
            product = Product.objects.get(id=attrs['product_id'])
        except Product.DoesNotExist:
            raise serializers.ValidationError(f"Product with id {attrs['product_id']} not found.")
        
        adjustment_type = attrs['adjustment_type']
        quantity = attrs['quantity']
        
        if adjustment_type == 'remove' and product.stock_quantity < quantity:
            raise serializers.ValidationError(
                f"Cannot remove {quantity} units. Only {product.stock_quantity} available."
            )
        
        attrs['_product'] = product
        return attrs


class PurchaseOrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_sku = serializers.CharField(source='product.sku', read_only=True)
    
    class Meta:
        model = PurchaseOrderItem
        fields = [
            'id', 'product', 'product_name', 'product_sku',
            'quantity_ordered', 'quantity_received', 'unit_cost', 'subtotal'
        ]
        read_only_fields = ['subtotal']


class PurchaseOrderListSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    items_count = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = PurchaseOrder
        fields = [
            'id', 'po_number', 'supplier', 'supplier_name',
            'order_date', 'expected_delivery_date', 'status', 'status_display',
            'total', 'items_count', 'created_by_name', 'created_at'
        ]
    
    def get_items_count(self, obj):
        return obj.items.count()


class PurchaseOrderDetailSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    items = PurchaseOrderItemSerializer(many=True, read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    
    class Meta:
        model = PurchaseOrder
        fields = [
            'id', 'po_number', 'supplier', 'supplier_name',
            'order_date', 'expected_delivery_date', 'received_date',
            'status', 'status_display', 'subtotal', 'tax_amount', 'total',
            'notes', 'items', 'created_by', 'created_by_name',
            'created_at', 'updated_at'
        ]


class PurchaseOrderCreateSerializer(serializers.Serializer):
    supplier_id = serializers.IntegerField()
    expected_delivery_date = serializers.DateField(required=False, allow_null=True)
    items = serializers.ListField(child=serializers.DictField())
    notes = serializers.CharField(required=False, allow_blank=True)
    
    def validate_supplier_id(self, value):
        try:
            Supplier.objects.get(id=value)
        except Supplier.DoesNotExist:
            raise serializers.ValidationError(f"Supplier with id {value} not found.")
        return value
    
    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError("At least one item is required.")
        
        for item in value:
            if 'product_id' not in item or 'quantity' not in item or 'unit_cost' not in item:
                raise serializers.ValidationError(
                    "Each item must have product_id, quantity, and unit_cost."
                )
        
        return value
    
    def create(self, validated_data):
        from django.db import transaction
        from decimal import Decimal
        
        items_data = validated_data.pop('items')
        
        with transaction.atomic():
            # Create purchase order
            po = PurchaseOrder.objects.create(
                supplier_id=validated_data['supplier_id'],
                expected_delivery_date=validated_data.get('expected_delivery_date'),
                notes=validated_data.get('notes', ''),
                created_by=self.context['request'].user,
                status='pending'
            )
            
            # Create items and calculate totals
            subtotal = Decimal('0.00')
            
            for item_data in items_data:
                product = Product.objects.get(id=item_data['product_id'])
                quantity = int(item_data['quantity'])
                unit_cost = Decimal(str(item_data['unit_cost']))
                
                PurchaseOrderItem.objects.create(
                    purchase_order=po,
                    product=product,
                    quantity_ordered=quantity,
                    unit_cost=unit_cost
                )
                
                subtotal += unit_cost * quantity
            
            # Update PO totals
            po.subtotal = subtotal
            po.tax_amount = subtotal * Decimal('0.16')  # 16% tax
            po.total = po.subtotal + po.tax_amount
            po.save()
        
        return po


class StockAlertSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_sku = serializers.CharField(source='product.sku', read_only=True)
    
    class Meta:
        model = StockAlert
        fields = [
            'id', 'product', 'product_name', 'product_sku',
            'alert_level', 'current_stock', 'is_resolved',
            'resolved_at', 'created_at'
        ]