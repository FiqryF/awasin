"""Wire subset of google/security/safebrowsing/v5/safebrowsing.proto."""

from google.protobuf import descriptor_pb2, descriptor_pool, duration_pb2, message_factory, text_format

# Enum fields use their wire-compatible integer representation so future
# enum values can be ignored without dropping other details for the same hash.
_schema = text_format.Parse("""
name: "awasin_safe_browsing_v5.proto"
package: "awasin.safebrowsing.v5"
syntax: "proto3"
dependency: "google/protobuf/duration.proto"
message_type {
  name: "FullHashDetail"
  field { name: "threat_type" number: 1 type: TYPE_INT32 }
  field { name: "attributes" number: 2 type: TYPE_INT32 label: LABEL_REPEATED }
}
message_type {
  name: "FullHash"
  field { name: "full_hash" number: 1 type: TYPE_BYTES }
  field {
    name: "full_hash_details" number: 2 type: TYPE_MESSAGE label: LABEL_REPEATED
    type_name: ".awasin.safebrowsing.v5.FullHashDetail"
  }
}
message_type {
  name: "SearchHashesResponse"
  field {
    name: "full_hashes" number: 1 type: TYPE_MESSAGE label: LABEL_REPEATED
    type_name: ".awasin.safebrowsing.v5.FullHash"
  }
  field {
    name: "cache_duration" number: 2 type: TYPE_MESSAGE
    type_name: ".google.protobuf.Duration"
  }
}
""", descriptor_pb2.FileDescriptorProto())

_pool = descriptor_pool.DescriptorPool()
_pool.AddSerializedFile(duration_pb2.DESCRIPTOR.serialized_pb)
_pool.Add(_schema)
SearchHashesResponse = message_factory.GetMessageClass(
    _pool.FindMessageTypeByName("awasin.safebrowsing.v5.SearchHashesResponse")
)
