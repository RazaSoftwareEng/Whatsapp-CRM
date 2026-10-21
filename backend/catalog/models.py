from django.db import models

MAX_IMAGES_PER_PRODUCT = 5


class Product(models.Model):
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    category = models.CharField(max_length=100, blank=True)
    in_stock = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.name


class ProductImage(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="images")
    image = models.FileField(upload_to="products/")
    # The one image to show first / with priority (e.g. a product card's thumbnail).
    # At most one per product — enforced in the view, not the DB (see
    # ProductImageViewSet.perform_create/perform_update).
    is_featured = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        # Featured image first, then oldest-first among the rest — so "the first
        # item in product.images" is always the right one to show as primary.
        ordering = ["-is_featured", "created_at"]

    def __str__(self):
        return f"{self.product.name} image #{self.pk}"
