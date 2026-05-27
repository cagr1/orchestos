mod models;
mod services;
use crate::models::User;
fn main() { let _u = User { id: 1, name: "test".to_string() }; }