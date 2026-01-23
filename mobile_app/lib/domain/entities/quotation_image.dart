class QuotationImage {
  const QuotationImage({
    required this.id,
    required this.imageUrl,
    required this.uploadedAt,
    required this.isApproved,
    this.userId,
  });

  final String id;
  final String imageUrl;
  final String uploadedAt;
  final bool isApproved;
  final String? userId;

  factory QuotationImage.fromJson(Map<String, dynamic> json) {
    final rawApproved = json['is_approved'] ?? json['isApproved'];
    return QuotationImage(
      id: json['id']?.toString() ?? '',
      imageUrl: json['image_url']?.toString() ??
          json['imageUrl']?.toString() ??
          '',
      uploadedAt: json['uploaded_at']?.toString() ??
          json['uploadedAt']?.toString() ??
          '',
      isApproved: rawApproved == true || rawApproved == 1,
      userId: json['user_id']?.toString() ?? json['userId']?.toString(),
    );
  }
}
