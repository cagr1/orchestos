use crate::models::User;
pub fn get_user(id: u32) -> User { User { id, name: "test".to_string() } }