#!/usr/bin/env python3
import torch
import os
from safetensors.torch import save_file, load_file

model_path = "model.safetensors"
output_dir = "sharded_smart"
max_shard_mb = 90

print("🧠 Smart sharding...")

# Create output dir
os.makedirs(output_dir, exist_ok=True)

state_dict = load_file(model_path)
tensors_by_size = sorted(state_dict.items(), key=lambda x: x[1].numel() * x[1].element_size(), reverse=True)

current_shard = {}
current_size = 0
shard_count = 0

for name, tensor in tensors_by_size:
    tensor_bytes = tensor.numel() * tensor.element_size()
    
    if current_size + tensor_bytes > max_shard_mb * 1e6 or not current_shard:
        # Save previous shard
        if current_shard:
            shard_path = f"{output_dir}/model.safetensors.{shard_count:05d}"
            save_file(current_shard, shard_path)
            size_mb = os.path.getsize(shard_path) / 1e6
            print(f"✅ {shard_path} ({size_mb:.1f}MB)")
            shard_count += 1
        
        # Start new shard
        current_shard = {name: tensor}
        current_size = tensor_bytes
    else:
        current_shard[name] = tensor
        current_size += tensor_bytes

# Final shard
if current_shard:
    shard_path = f"{output_dir}/model.safetensors.{shard_count:05d}"
    save_file(current_shard, shard_path)
    size_mb = os.path.getsize(shard_path) / 1e6
    print(f"✅ {shard_path} ({size_mb:.1f}MB)")

print(f"\n🎉 {shard_count+1} shards (all <90MB) → GitHub ready!")
print("rm model.safetensors")

