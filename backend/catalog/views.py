from rest_framework import permissions, viewsets
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser

from accounts.permissions import IsAdmin

from .models import MAX_IMAGES_PER_PRODUCT, Product, ProductImage
from .serializers import ProductImageSerializer, ProductSerializer


class ProductViewSet(viewsets.ModelViewSet):
    """Admin-only catalog management (create/edit/delete) — call with a JWT
    access token, same as the rest of this API. No UI; API-only by design."""

    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def _apply_legacy_image_upload(self, product, request):
        """Back-compat: a client sending a single "image" file on
        create/update (the old single-image API shape) still works — it
        replaces the featured ProductImage (or creates one) instead of being
        silently dropped now that Product has no image field of its own."""
        image_file = request.FILES.get("image")
        if not image_file:
            return
        featured = product.images.filter(is_featured=True).first()
        if featured:
            featured.image = image_file
            featured.save(update_fields=["image"])
            return
        if product.images.count() >= MAX_IMAGES_PER_PRODUCT:
            product.images.order_by("created_at").first().delete()
        ProductImage.objects.create(product=product, image=image_file, is_featured=True)

    def perform_create(self, serializer):
        product = serializer.save()
        self._apply_legacy_image_upload(product, self.request)

    def perform_update(self, serializer):
        product = serializer.save()
        self._apply_legacy_image_upload(product, self.request)


class ProductImageViewSet(viewsets.ModelViewSet):
    """Admin-only — upload/remove a product's images and pick which one is
    "featured" (shown first/with priority). Max 5 images per product; marking
    one as featured automatically un-features any other image on that same
    product, so at most one stays featured at a time."""

    queryset = ProductImage.objects.all()
    serializer_class = ProductImageSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def perform_create(self, serializer):
        product = serializer.validated_data["product"]
        if product.images.count() >= MAX_IMAGES_PER_PRODUCT:
            raise ValidationError({"detail": f"A product can have at most {MAX_IMAGES_PER_PRODUCT} images."})
        instance = serializer.save()
        if instance.is_featured:
            product.images.exclude(pk=instance.pk).update(is_featured=False)

    def perform_update(self, serializer):
        instance = serializer.save()
        if instance.is_featured:
            instance.product.images.exclude(pk=instance.pk).update(is_featured=False)


class PublicProductViewSet(viewsets.ReadOnlyModelViewSet):
    """Open, read-only catalog feed — no login required. Meant for other
    projects to pull Al Merak's product list (see /api/public/products/).
    CORS_ALLOWED_ORIGINS controls which sites may call this from a browser;
    server-to-server calls aren't restricted by CORS at all."""

    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
