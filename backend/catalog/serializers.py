from rest_framework import serializers

from .models import Product, ProductImage


class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = ["id", "product", "image", "is_featured", "created_at"]
        read_only_fields = ["id", "created_at"]


class ProductSerializer(serializers.ModelSerializer):
    images = ProductImageSerializer(many=True, read_only=True)
    # Back-compat convenience: the featured image's URL (or the oldest one if
    # none is featured), so a client still expecting a single "image" field
    # keeps working — writing a legacy image upload is handled in the view
    # (ProductViewSet._apply_legacy_image_upload), not here.
    image = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id",
            "name",
            "description",
            "price",
            "image",
            "images",
            "category",
            "in_stock",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_image(self, obj):
        first = obj.images.first()  # ProductImage ordering already puts featured first
        if not first or not first.image:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(first.image.url) if request else first.image.url
