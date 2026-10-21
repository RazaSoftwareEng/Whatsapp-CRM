from rest_framework.routers import DefaultRouter

from .views import PublicProductViewSet

router = DefaultRouter()
router.register("products", PublicProductViewSet, basename="public-product")

urlpatterns = router.urls
