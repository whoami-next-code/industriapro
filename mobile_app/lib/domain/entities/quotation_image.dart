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
    return QuotationImage(
      id: json['id']?.toString() ?? '',
      imageUrl: json['image_url']?.toString() ?? '',
      uploadedAt: json['uploaded_at']?.toString() ?? '',
      isApproved: json['is_approved'] == true || json['is_approved'] == 1,
      userId: json['user_id']?.toString(),
    );
  }
}
